class ClickCallManager {
  constructor() {
    this.uploadInput = null;
    this.contactsTable = null;
    this.contacts = [];
    this.isInitialized = false;
    this.addButton = null;
    this.localStorageKey = 'clickcall_contatos';
    this.localStorageTranscriptionsKey = 'clickcall_transcriptions';
    this.sortField = null;
    this.sortDirection = 1; // 1 = crescente, -1 = decrescente
    this.filteredContacts = null;
    this.currentPage = 1;
    this.contactsPerPage = 10;
    this.paginationDiv = null;
    this.searchInput = null;
    this.exportButton = null;
    this.exportSelect = null;
    this.perPageSelect = null;
    this._lastImportHash = null;
    this._lastImportFileName = null;

    this.webhookServerUrl = 'http://localhost:4201'; // Backend local onde o webhook-server.js está rodando
    this.webhookPollingInterval = 5000; // 5 segundos (ajustável)
    this.webhookPollingIntervalId = null;
    this._webhookConnectionErrorLogged = false;

    this.transcriptions = {}; // Armazena transcrições por código de gravação
    this.transcribing = {}; // Controla estado de transcrição (loading)

    this.init();
  }

  async init() {
    try {

      await this.waitForDependencies();
      this.setupElements();
      this.loadContactsFromStorage();
      this.loadTranscriptionsFromStorage();
      this.bindEvents();
      this.setupWebhookListener(); // Configurar listener de webhook
      this.startWebhookPolling(); // Iniciar polling de webhooks do backend
      this.isInitialized = true;
      this.displayContacts(this.contacts);
    } catch (error) {
      console.error('Erro ao inicializar ClickCall Manager:', error);
      this.showError('Erro ao inicializar a aplicação');
    }
  }

  async waitForDependencies() {
    return new Promise((resolve, reject) => {
      const maxAttempts = 50;
      let attempts = 0;
      const checkDependencies = () => {
        attempts++;

        if (typeof XLSX !== 'undefined' && document.readyState === 'complete') {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Timeout: Dependências não carregadas'));
        } else {
          setTimeout(checkDependencies, 100);
        }
      };
      checkDependencies();
    });
  }

  setupElements() {
    this.uploadInput = document.getElementById('upload');
    this.contactsTable = document.getElementById('contactsTable');
    if (!this.uploadInput) throw new Error('Elemento de upload não encontrado');
    if (!this.contactsTable) throw new Error('Tabela de contatos não encontrada');
    const thead = this.contactsTable.querySelector('thead tr');
    if (thead && thead.children.length === 4) {
      const th = document.createElement('th');
      th.textContent = 'Já liguei';
      thead.appendChild(th);
    }
    this.searchInput = this.createInput('text', 'Buscar por contato, ramal, telefone ou cpf...', 'search-input');
    this.contactsTable.parentNode.insertBefore(this.searchInput, this.contactsTable);
    this.addButton = this.createButton('Adicionar Contato', 'add-contact-btn');
    this.contactsTable.parentNode.insertBefore(this.addButton, this.contactsTable);
    this.exportButton = this.createButton('Exportar', 'export-btn');
    this.contactsTable.parentNode.insertBefore(this.exportButton, this.contactsTable);
    this.exportSelect = this.createSelect('export-select', [
      { value: 'xlsx', text: 'Excel (.xlsx)' },
      { value: 'csv', text: 'CSV (.csv)' }
    ]);
    this.contactsTable.parentNode.insertBefore(this.exportSelect, this.contactsTable);
    this.paginationDiv = document.createElement('div');
    this.paginationDiv.className = 'pagination-controls';
    this.contactsTable.parentNode.appendChild(this.paginationDiv);
    this.addSortEvents();
  }

  createInput(type, placeholder, className) {
    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    input.className = className;
    return input;
  }

  createButton(text, className) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = className;
    return btn;
  }

  createSelect(className, options) {
    const select = document.createElement('select');
    select.className = className;
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      select.appendChild(option);
    });
    return select;
  }

  addSortEvents() {
    const thead = this.contactsTable.querySelector('thead tr');
    if (!thead) return;
    const headers = ['Contato', 'Ramal', 'Telefone', 'Ação', 'CPF', 'Já liguei', 'Observação'];
    thead.querySelectorAll('th').forEach((th, idx) => {
      if (headers[idx] === 'Ação') return;
      th.style.cursor = 'pointer';
      th.title = 'Clique para ordenar';
      th.onclick = () => {
        let field;
        switch (headers[idx]) {
          case 'Contato': field = 'contato'; break;
          case 'Ramal': field = 'ramal'; break;
          case 'Telefone': field = 'numero'; break;
          case 'CPF': field = 'cpf'; break;
          case 'Já liguei': field = 'done'; break;
          case 'Observação': field = 'observacao'; break;
        }
        if (this.sortField === field) {
          this.sortDirection *= -1;
        } else {
          this.sortField = field;
          this.sortDirection = 1;
        }
        this.applySortAndDisplay();
      };
    });
  }

  applySortAndDisplay() {
    let data = this.filteredContacts !== null ? this.filteredContacts : this.contacts;
    if (this.sortField) {
      data = [...data].sort((a, b) => {
        let valA = a[this.sortField];
        let valB = b[this.sortField];
        if (this.sortField === 'done') {
          valA = !!valA; valB = !!valB;
        } else {
          valA = (valA || '').toString().toLowerCase();
          valB = (valB || '').toString().toLowerCase();
        }
        if (valA < valB) return -1 * this.sortDirection;
        if (valA > valB) return 1 * this.sortDirection;
        return 0;
      });
    }
    this.displayContacts(data);
  }

  bindEvents() {
    this.uploadInput.addEventListener('change', this.handleFileUpload.bind(this));
    this.addButton.addEventListener('click', this.handleAddContact.bind(this));
    this.exportButton.addEventListener('click', this.handleExport.bind(this));
    this.searchInput.addEventListener('input', this.handleSearch.bind(this));

    this.uploadInput.addEventListener('dragenter', this.handleDragEnter.bind(this));
    this.uploadInput.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.uploadInput.addEventListener('dragover', this.handleDragOver.bind(this));
    this.uploadInput.addEventListener('drop', this.handleDrop.bind(this));
  }

  handleExport() {
    const format = this.exportSelect.value;

    if (!this.contacts.length) {
      this.showWarning('Não há contatos para exportar.');
      return;
    }

    const data = this.contacts.map(c => ({
      'CONTATO': c.CONTATO || c.contato || c.NOME || c.nome || c.PESSOA || c.pessoa || c.CLIENTE || c.cliente || '',
      'CPF / CNPJ': c.CPF || c.cpf || c.CNPJ || c.cnpj || '',
      'RAMAL': c.RAMAL || c.ramal || '',
      'TELEFONE': c.TELEFONE || c.numero || '',
      'JÁ LIGUEI': c.done ? 'Sim' : 'Não',
      'OBSERVAÇÃO': c.OBSERVAÇÃO || c.observacao || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos');

    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const dateStr = `${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const fileName = `ClickCall(${dateStr}).${format}`;

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      this.downloadFile(csv, fileName, 'text/csv');
    } else {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      this.downloadFile(blob, fileName);
    }
  }

  exportTemplate() {

    const templateData = [
      {
        'CONTATO': 'João Silva',
        'CPF / CNPJ': '123.456.789-00',
        'RAMAL': '1234567',
        'TELEFONE': '16981892476',
        'JÁ LIGUEI': 'Não',
        'OBSERVAÇÃO': 'Cliente preferencial'
      },
      {
        'CONTATO': 'Maria Santos',
        'CPF / CNPJ': '987.654.321-00',
        'RAMAL': '7654321',
        'TELEFONE': '11987654321',
        'JÁ LIGUEI': 'Sim',
        'OBSERVAÇÃO': 'Retornar ligação'
      },
      {
        'CONTATO': 'Empresa ABC Ltda',
        'CPF / CNPJ': '12.345.678/0001-90',
        'RAMAL': '1111111',
        'TELEFONE': '11888888888',
        'JÁ LIGUEI': 'Não',
        'OBSERVAÇÃO': 'Contato comercial'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    this.addTemplateFormatting(ws);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Contatos');

    this.addInstructionsSheet(wb);

    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const dateStr = `${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const fileName = `ClickCall_Template(${dateStr}).xlsx`;

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    this.downloadFile(blob, fileName);

    this.showSuccess('Tabela padrão exportada com sucesso! Preencha os dados e importe novamente.');
  }

  addTemplateFormatting(ws) {

    const colWidths = [
      { wch: 25 }, // CONTATO
      { wch: 18 }, // CPF / CNPJ
      { wch: 12 }, // RAMAL
      { wch: 15 }, // TELEFONE
      { wch: 10 }, // JÁ LIGUEI
      { wch: 30 }  // OBSERVAÇÃO
    ];
    ws['!cols'] = colWidths;

    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '4472C4' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }
  }

  addInstructionsSheet(wb) {
    const instructions = [
      ['INSTRUÇÕES PARA PREENCHIMENTO DA TABELA'],
      [''],
      ['CAMPOS OBRIGATÓRIOS:'],
      ['• CONTATO: Nome completo da pessoa ou empresa'],
      ['• RAMAL: Número do ramal (mínimo 7 dígitos, apenas números)'],
      ['• TELEFONE: Número de telefone (mínimo 8 dígitos, apenas números)'],
      [''],
      ['CAMPOS OPCIONAIS:'],
      ['• CPF / CNPJ: CPF (11 dígitos) ou CNPJ (14 dígitos)'],
      ['• JÁ LIGUEI: Digite "Sim" ou "Não" (padrão: "Não")'],
      ['• OBSERVAÇÃO: Qualquer informação adicional'],
      [''],
      ['FORMATOS ACEITOS:'],
      ['• CPF: 123.456.789-00 ou 12345678900'],
      ['• CNPJ: 12.345.678/0001-90 ou 12345678000190'],
      ['• RAMAL: Apenas números (ex: 1234567)'],
      ['• TELEFONE: Apenas números (ex: 16981892476)'],
      [''],
      ['IMPORTANTE:'],
      ['• Mantenha os cabeçalhos das colunas exatamente como estão'],
      ['• Não altere a ordem das colunas'],
      ['• Para importar, use o botão "Escolher arquivo" no sistema'],
      ['• O sistema aceita arquivos .xlsx e .csv']
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);

    const instructionRange = XLSX.utils.decode_range(wsInstructions['!ref']);
    for (let row = instructionRange.s.r; row <= instructionRange.e.r; row++) {
      for (let col = instructionRange.s.c; col <= instructionRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (wsInstructions[cellAddress]) {
          if (row === 0) {

            wsInstructions[cellAddress].s = {
              font: { bold: true, size: 14, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '2E75B6' } },
              alignment: { horizontal: 'center' }
            };
          } else if (row === 2 || row === 7 || row === 12 || row === 18) {

            wsInstructions[cellAddress].s = {
              font: { bold: true, color: { rgb: '2E75B6' } },
              fill: { fgColor: { rgb: 'D9E2F3' } }
            };
          }
        }
      }
    }

    wsInstructions['!cols'] = [{ wch: 80 }];

    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções');
  }

  downloadFile(data, filename, mimeType) {
    let url;
    if (typeof data === 'string') {
      url = URL.createObjectURL(new Blob([data], { type: mimeType || 'application/octet-stream' }));
    } else {
      url = URL.createObjectURL(data);
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  loadContactsFromStorage() {
    const data = localStorage.getItem(this.localStorageKey);
    if (data) {
      try {
        this.contacts = JSON.parse(data);

        this.contacts = this.contacts.map((contact, index) => {
          if (!contact.gravacoes) {
            contact.gravacoes = [];
          }

          if (contact.gravacoes && contact.gravacoes.length > 0) {
          }
          return contact;
        });

        const totalGravacoes = this.contacts.reduce((total, c) => total + (c.gravacoes?.length || 0), 0);

        this.saveContactsToStorage();
      } catch (e) {
        console.error('[loadContactsFromStorage] ERRO ao carregar contatos:', e);
        this.contacts = [];
      }
    } else {
    }
  }

  saveContactsToStorage() {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.contacts));
  }

  loadTranscriptionsFromStorage() {
    const data = localStorage.getItem(this.localStorageTranscriptionsKey);
    if (data) {
      try {
        this.transcriptions = JSON.parse(data);
      } catch (e) {
        console.error('[loadTranscriptionsFromStorage] ERRO ao carregar transcrições:', e);
        this.transcriptions = {};
      }
    }
  }

  saveTranscriptionsToStorage() {
    try {
      localStorage.setItem(this.localStorageTranscriptionsKey, JSON.stringify(this.transcriptions));
    } catch (e) {
      console.error('[saveTranscriptionsToStorage] ERRO ao salvar transcrições:', e);
    }
  }

  handleSearch() {
    const term = this.searchInput.value.trim().toLowerCase();
    this.currentPage = 1;
    if (!term) {
      this.filteredContacts = null;
      this.applySortAndDisplay();
      return;
    }

    const termDigits = term.replace(/\D/g, '');
    this.filteredContacts = this.contacts.filter(c => {
      const cpfDigits = c.cpf ? c.cpf.replace(/\D/g, '') : '';
      return (
        (c.contato && c.contato.toLowerCase().includes(term)) ||
        (c.ramal && c.ramal.toString().toLowerCase().includes(term)) ||
        (c.numero && c.numero.toString().toLowerCase().includes(term)) ||
        (c.cpf && (
          c.cpf.toString().toLowerCase().includes(term) ||
          (termDigits && cpfDigits.includes(termDigits))
        ))
      );
    });
    this.applySortAndDisplay();
  }

  handleAddContact() {
    const tbody = this.contactsTable.querySelector('tbody');
    if (tbody.querySelector('.edit-row')) return;
    const tr = document.createElement('tr');
    tr.className = 'edit-row';
    tr.innerHTML = `
      <td><input type="text" placeholder="CONTATO" required></td>
      <td><input type="text" placeholder="CPF / CNPJ" maxlength="18"></td>
      <td><input type="text" placeholder="RAMAL" required></td>
      <td><input type="text" placeholder="TELEFONE" required></td>
      <td style="text-align:center;"><input type="checkbox" class="checkbox-done" title="JÁ LIGUEI"></td>
      <td class="td-acao"></td>
      <td><textarea placeholder="OBSERVAÇÃO" rows="1" style="resize:none;overflow:hidden;width:100%"></textarea></td>
      <td class="td-gravacao" style="text-align:center;"><span style="color: #ccc; font-size: 0.9rem;">—</span></td>
    `;
    const tdActions = tr.querySelector('.td-acao');
    const btnSave = this.createButton('Salvar', 'save-btn');
    const btnCancel = this.createButton('Cancelar', 'cancel-btn');
    tdActions.appendChild(btnSave);
    tdActions.appendChild(btnCancel);
    tbody.insertBefore(tr, tbody.firstChild);

    const cpfInput = tr.children[1].querySelector('input');
    cpfInput.addEventListener('input', function() {
      this.value = formatarCpfCnpj(this.value);
    });

    const obsTextarea = tr.children[6].querySelector('textarea');
    obsTextarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });

    btnSave.onclick = () => {
      const CONTATO = tr.children[0].querySelector('input').value.trim();
      const CPF = tr.children[1].querySelector('input').value.trim();
      const RAMAL = tr.children[2].querySelector('input').value.trim();
      const TELEFONE = tr.children[3].querySelector('input').value.trim();
      const JALIGUEI = tr.children[4].querySelector('input').checked;
      const OBSERVAÇÃO = tr.children[6].querySelector('textarea').value.trim();
      if (!CONTATO || !RAMAL || !TELEFONE) {
        this.showWarning('Preencha todos os campos obrigatórios: CONTATO, RAMAL e TELEFONE.');
        return;
      }
      if (!/^[0-9]{7,}$/.test(RAMAL)) {
        this.showError('O campo RAMAL deve conter apenas números e ter pelo menos 7 dígitos.');
        return;
      }
      if (!/^[0-9]{8,}$/.test(TELEFONE)) {
        this.showError('O campo TELEFONE deve conter apenas números e ter pelo menos 8 dígitos.');
        return;
      }
      if (CPF && !validarCpfCnpj(CPF)) {
        this.showError('CPF ou CNPJ inválido.');
        return;
      }
      this.contacts.unshift({ contato: CONTATO, cpf: CPF, ramal: RAMAL, numero: TELEFONE, done: JALIGUEI, observacao: OBSERVAÇÃO, gravacoes: [] });
      this.saveContactsToStorage();
      this.currentPage = 1;
      this.applySortAndDisplay();
    };
    btnCancel.onclick = () => {
      tr.remove();
    };
  }

  renderPagination(totalPages) {
    if (!this.paginationDiv) return;
    this.paginationDiv.innerHTML = '';

    if (totalPages > 1) {
      const prevBtn = this.createButton('Anterior', '');
      prevBtn.disabled = this.currentPage === 1;
      prevBtn.onclick = () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.applySortAndDisplay();
        }
      };
      const nextBtn = this.createButton('Próxima', '');
      nextBtn.disabled = this.currentPage === totalPages;
      nextBtn.onclick = () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.applySortAndDisplay();
        }
      };
      const pageInfo = document.createElement('span');
      pageInfo.textContent = `Página ${this.currentPage} de ${totalPages}`;
      this.paginationDiv.appendChild(prevBtn);
      this.paginationDiv.appendChild(pageInfo);
      this.paginationDiv.appendChild(nextBtn);
    } else {

      const pageInfo = document.createElement('span');
      pageInfo.textContent = `Página 1 de 1`;
      this.paginationDiv.appendChild(pageInfo);
    }

    if (!this.perPageSelect) {
      this.perPageSelect = this.createSelect('per-page-select', [
        { value: '10', text: '10 por página' },
        { value: '25', text: '25 por página' },
        { value: '50', text: '50 por página' }
      ]);
      this.perPageSelect.value = this.contactsPerPage;
      this.perPageSelect.addEventListener('change', this.handlePerPageChange.bind(this));
    }
    const perPageWrapper = document.createElement('div');
    perPageWrapper.className = 'per-page-wrapper';
    perPageWrapper.appendChild(this.perPageSelect);
    this.paginationDiv.appendChild(perPageWrapper);
  }

  handlePerPageChange() {
    this.contactsPerPage = parseInt(this.perPageSelect.value, 10);
    this.currentPage = 1;
    this.applySortAndDisplay();
  }

  createContactRow(contact, index) {
    const tr = document.createElement('tr');
    tr.className = 'contact-row';

    const callLink = this.createCallLink(contact.ramal, contact.numero, contact.contato);

    const temContato = contact.contato && contact.contato.trim() !== '';
    const gravarIcone = temContato 
      ? '<button class="gravar-btn" title="Ver gravação" data-contact-index="' + index + '">🎧</button>'
      : '<span style="color: #ccc; font-size: 0.9rem;">—</span>';
    tr.innerHTML = `
      <td class="td-contato">${this.escapeHtml(contact.contato)}</td>
      <td class="td-cpf">${this.escapeHtml(contact.cpf || '')}</td>
      <td class="td-ramal">${this.escapeHtml(contact.ramal)}</td>
      <td class="td-numero">${this.escapeHtml(formatarNumeroVisual(contact.numero))}</td>
      <td style="text-align:center;" class="td-done"><input type="checkbox" ${contact.done ? 'checked' : ''} data-index="${index}" class="checkbox-done" title="Já liguei"></td>
      <td class="td-acao">${callLink}<button class="edit-btn" title="Editar">Editar</button><button class="delete-btn" title="Remover">Remover</button></td>
      <td class="td-observacao"><div class="obs-view" style="white-space:pre-line;min-height:24px;padding:4px 0;cursor:pointer;">${this.escapeHtml(contact.observacao || '')}</div></td>
      <td class="td-gravacao" style="text-align:center;">${gravarIcone}</td>
    `;
    const checkbox = tr.querySelector('.checkbox-done');
    checkbox.addEventListener('change', () => {

      const realIndex = this.contacts.findIndex(c => c.ramal === contact.ramal && c.numero === contact.numero);
      if (realIndex !== -1) {
        this.contacts[realIndex].done = checkbox.checked;
        this.saveContactsToStorage();
      }
    });
    const btnDelete = tr.querySelector('.delete-btn');
    btnDelete.onclick = () => this.handleDeleteContact(index);
    const btnEdit = tr.querySelector('.edit-btn');
    btnEdit.onclick = () => this.handleEditContact(tr, contact, index);
    const btnCall = tr.querySelector('.call-button');
    if (btnCall) {
      const url = btnCall.getAttribute('data-call-url');
      btnCall.onclick = (e) => {
        const urlFromClick = btnCall.getAttribute('data-call-url');
        if (!urlFromClick) {
          console.error('[createContactRow] Erro: URL não encontrada no atributo data-call-url');
          this.showError('Erro: URL da chamada não encontrada. Recarregue a página.');
          return;
        }
        this.executeCall(urlFromClick);
      };
    } else {
    }

    const btnGravacao = tr.querySelector('.gravar-btn');
    if (btnGravacao) {
      btnGravacao.onclick = () => {

        const realIndex = this.contacts.findIndex(c => 
          c.ramal === contact.ramal && 
          c.numero === contact.numero && 
          c.contato === contact.contato
        );
        const contatoCompleto = realIndex !== -1 ? this.contacts[realIndex] : contact;
        this.showRecordingModal(contatoCompleto);
      };
    }

    const obsDiv = tr.querySelector('.obs-view');
    obsDiv.onclick = () => {
      if (tr.querySelector('textarea')) return;
      const valorAtual = contact.observacao || '';
      const textarea = document.createElement('textarea');
      textarea.className = 'obs-textarea';
      textarea.value = valorAtual;
      textarea.style.resize = 'none';
      textarea.style.minHeight = '24px';
      textarea.rows = 1;
      textarea.style.overflow = 'hidden';
      textarea.style.whiteSpace = 'pre-line';
      textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          salvarObs();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelarObs();
        }
      });

      const btnSalvar = document.createElement('button');
      btnSalvar.textContent = 'Salvar';
      btnSalvar.className = 'save-btn';
      btnSalvar.onclick = salvarObs;
      const btnCancelar = document.createElement('button');
      btnCancelar.textContent = 'Cancelar';
      btnCancelar.className = 'cancel-btn';
      btnCancelar.onclick = cancelarObs;

      function restaurarBotoes() {
        tdAcao.innerHTML = `${callLink}<button class="edit-btn" title="Editar">Editar</button><button class="delete-btn" title="Remover">Remover</button>`;
        tdAcao.querySelector('.edit-btn').onclick = () => self.handleEditContact(tr, contact, index);
        tdAcao.querySelector('.delete-btn').onclick = () => self.handleDeleteContact(index);

        const callButton = tdAcao.querySelector('.call-button');
        if (callButton) {
          callButton.onclick = () => {
            const url = callButton.getAttribute('data-call-url');
            self.executeCall(url);
          };
        }
      }

      function salvarObs() {
        contact.observacao = textarea.value.trim();
        self.saveContactsToStorage();
        obsDiv.innerHTML = self.escapeHtml(contact.observacao || '');
        obsDiv.style.whiteSpace = 'pre-line';
        obsDiv.style.minHeight = '24px';
        obsDiv.style.padding = '4px 0';
        obsDiv.style.cursor = 'pointer';

        restaurarBotoes();
      }
      function cancelarObs() {
        obsDiv.innerHTML = self.escapeHtml(contact.observacao || '');
        obsDiv.style.whiteSpace = 'pre-line';
        obsDiv.style.minHeight = '24px';
        obsDiv.style.padding = '4px 0';
        obsDiv.style.cursor = 'pointer';

        restaurarBotoes();
      }

      obsDiv.innerHTML = '';
      obsDiv.appendChild(textarea);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      textarea.dispatchEvent(new Event('input'));

      const tdAcao = tr.querySelector('.td-acao');
      const self = this;
      tdAcao.innerHTML = '';
      tdAcao.appendChild(btnSalvar);
      tdAcao.appendChild(btnCancelar);
    };
    return tr;
  }

  formatarNumeroTelefone(numero) {
    if (!numero) return '';

    return numero.toString().replace(/\D/g, '');
  }

  createCallLink(ramal, numero, contatoNome) {
    if (!ramal && !numero) {
      console.warn('[createCallLink] Dados insuficientes para criar link de chamada');
      return '<span class="no-data">Dados insuficientes</span>';
    }

    const numeroFormatado = this.formatarNumeroTelefone(numero);

    let link = `https://delorean.krolik.com.br/services/call?ramal=${encodeURIComponent(ramal)}&numero=${encodeURIComponent(numeroFormatado)}`;
    if (contatoNome && contatoNome.trim() !== '') {
      link += `&callid=${encodeURIComponent(contatoNome.trim())}`;
    }

    return `<button type="button" class="call-button" title="Fazer chamada" data-call-url="${link}">📞 Ligar</button>`;
  }

  executeCall(url) {
    if (!url) {
      console.error('[executeCall] URL não fornecida!');
      this.showError('Erro: URL da chamada não fornecida.');
      return;
    }

    try {

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = url;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        this.showSuccess('Chamada iniciada! Consulte o softphone.');
      };

      iframe.onerror = (error) => {
        console.error('[executeCall] Erro ao carregar iframe:', error);
        this.showError('Erro ao iniciar chamada. Tente novamente.');
      };

      this.showSuccess('Chamada iniciada! Consulte o softphone.');

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 5000);

    } catch (error) {
      console.error('[executeCall] Erro:', error);
      this.showError('Erro ao iniciar chamada. Tente novamente.');
    }
  }

  showEmptyState(tbody) {
    const tr = document.createElement('tr');

    const thCount = this.contactsTable.querySelectorAll('thead th').length;
    tr.innerHTML = `<td colspan="${thCount}" class="empty-state">Nenhum contato encontrado</td>`;
    tbody.appendChild(tr);
  }

  animateTableRows() {
    const rows = document.querySelectorAll('.contact-row');
    rows.forEach((row, index) => {
      row.style.opacity = '0';
      row.style.transform = 'translateY(20px)';
      setTimeout(() => {
        row.style.transition = 'all 0.3s ease';
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
      }, index * 50);
    });
  }

  async transcreverAudio(gravacao, index) {
    let codigo = gravacao.codigo || '';
    let companyCode = gravacao.company_id;
    
    if (!companyCode && gravacao.src) {
      const srcString = String(gravacao.src);
      if (srcString.length >= 3) {
        companyCode = srcString.substring(0, 3);
      }
    }
    
    if (!companyCode) {
      console.error('[transcreverAudio] ERRO: company_id não disponível na gravação');
      alert('❌ Código da empresa não disponível. Não é possível transcrever.');
      return;
    }

    companyCode = String(companyCode).trim();

    if (this.transcribing[codigo]) {
      return;
    }

    if (this.transcriptions[codigo]) {
      this.exibirTranscricao(codigo, index);
      return;
    }

    try {
      const checkTokenResponse = await fetch(`${this.webhookServerUrl}/api/check-token?companyCode=${encodeURIComponent(companyCode)}`);
      if (!checkTokenResponse.ok) {
        throw new Error(`HTTP ${checkTokenResponse.status}`);
      }
      const checkTokenData = await checkTokenResponse.json();
      
      if (!checkTokenData.hasToken) {
        this.showNoTokenModal();
        return;
      }
    } catch (error) {
      console.error('[transcreverAudio] Erro ao verificar token:', error);
      this.showNoTokenModal();
      return;
    }

    this.transcribing[codigo] = true;

    this.mostrarLoadingTranscricao(codigo, index);

    try {

      let audioUrl = gravacao.url || '';
      
      if (!audioUrl && codigo) {
        const calldate = gravacao.calldate || '';
        let ehGravacaoDeHoje = false;

        if (calldate) {
          try {
            const calldateStr = calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
            const dataGravacao = new Date(calldateStr);
            const hoje = new Date();

            const dataGravacaoSemHora = new Date(
              dataGravacao.getFullYear(),
              dataGravacao.getMonth(),
              dataGravacao.getDate()
            );
            const hojeSemHora = new Date(
              hoje.getFullYear(),
              hoje.getMonth(),
              hoje.getDate()
            );

            ehGravacaoDeHoje = dataGravacaoSemHora.getTime() === hojeSemHora.getTime();
          } catch (e) {
            console.warn('[transcreverAudio] Erro ao parsear data:', e);
          }
        }

        if (ehGravacaoDeHoje) {
          audioUrl = `https://delorean.krolik.com.br/records/${codigo}.wav`;
        } else {
          if (calldate && companyCode) {
            try {
              const calldateStr = calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
              const dataGravacao = new Date(calldateStr);
              const ano = dataGravacao.getFullYear();
              const mes = String(dataGravacao.getMonth() + 1).padStart(2, '0');
              const dia = String(dataGravacao.getDate()).padStart(2, '0');
              const dataFormatada = `${ano}-${mes}-${dia}`;
              audioUrl = `https://delorean.krolik.com.br/records/${dataFormatada}/${companyCode}/${codigo}.mp3`;
            } catch (e) {
              console.warn('[transcreverAudio] Erro ao formatar data para URL MP3:', e);
              audioUrl = `https://delorean.krolik.com.br/records/${codigo}.mp3`;
            }
          } else {
            audioUrl = `https://delorean.krolik.com.br/records/${codigo}.mp3`;
          }
        }
      }

      if (!codigo && audioUrl) {
        const urlMatch = audioUrl.match(/\/([^\/]+)\.(wav|mp3|m4a|ogg)$/i);
        if (urlMatch && urlMatch[1]) {
          codigo = urlMatch[1];
        } else {
          const recordMatch = audioUrl.match(/\/record[s]?\/?([^\/\?]+)/i);
          if (recordMatch && recordMatch[1]) {
            codigo = recordMatch[1];
          }
        }
      }

      if (!codigo) {
        console.error('[transcreverAudio] ERRO: Código da gravação não disponível');
        console.error('[transcreverAudio] Gravacao:', gravacao);
        alert('❌ Código da gravação não disponível. Não é possível transcrever.');
        this.transcribing[codigo] = false;
        return;
      }

      const response = await fetch(`${this.webhookServerUrl}/api/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioUrl: audioUrl,
          codigo: codigo,
          companyCode: companyCode,
          calldate: gravacao.calldate || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.transcription) {

        const providerNormalizado = (data.provider || 'unknown').toLowerCase();
        this.transcriptions[codigo] = {
          texto: data.transcription || '',
          provider: providerNormalizado,
          model: data.model || 'unknown',
          duration: data.duration || 0,
          requestId: data.requestId || '',
          timestamp: new Date().toISOString()
        };

        this.saveTranscriptionsToStorage();
        this.exibirTranscricao(codigo, index);
      } else {
        throw new Error(data.message || 'Erro desconhecido na transcrição');
      }

    } catch (error) {
      console.error('[transcreverAudio] ❌ Erro:', error);

      this.mostrarErroTranscricao(codigo, index, error.message);

      this.showTranscriptionErrorModal(error.message);
    } finally {

      delete this.transcribing[codigo];
    }
  }

  async retranscreverAudio(codigo, index, event) {
    if (event) {
      event.stopPropagation();
    }

    if (this.transcribing[codigo]) {
      return;
    }

    this.loadContactsFromStorage();
    
    let gravacao = null;
    for (const contato of this.contacts) {
      if (contato.gravacoes && contato.gravacoes.length > 0) {
        gravacao = contato.gravacoes.find(g => g.codigo === codigo);
        if (gravacao) {
          break;
        }
      }
    }

    if (!gravacao) {
      alert('❌ Gravação não encontrada.');
      return;
    }

    let companyCode = gravacao.company_id;
    
    if (!companyCode && gravacao.src) {
      const srcString = String(gravacao.src);
      if (srcString.length >= 3) {
        companyCode = srcString.substring(0, 3);
      }
    }
    
    if (!companyCode) {
      console.error('[retranscreverAudio] ERRO: company_id não disponível na gravação');
      alert('❌ Código da empresa não disponível. Não é possível retranscrever.');
      return;
    }

    companyCode = String(companyCode).trim();

    try {
      const checkTokenResponse = await fetch(`${this.webhookServerUrl}/api/check-token?companyCode=${encodeURIComponent(companyCode)}`);
      if (!checkTokenResponse.ok) {
        throw new Error(`HTTP ${checkTokenResponse.status}`);
      }
      const checkTokenData = await checkTokenResponse.json();
      
      if (!checkTokenData.hasToken) {
        this.showNoTokenModal();
        return;
      }
    } catch (error) {
      console.error('[retranscreverAudio] Erro ao verificar token:', error);
      this.showNoTokenModal();
      return;
    }

    this.transcribing[codigo] = true;

    this.mostrarLoadingTranscricao(codigo, index);

    try {
      let audioUrl = gravacao.url || '';
      
      if (!audioUrl && codigo) {
        const calldate = gravacao.calldate || '';
        let ehGravacaoDeHoje = false;

        if (calldate) {
          try {
            const calldateStr = calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
            const dataGravacao = new Date(calldateStr);
            const hoje = new Date();

            const dataGravacaoSemHora = new Date(
              dataGravacao.getFullYear(),
              dataGravacao.getMonth(),
              dataGravacao.getDate()
            );
            const hojeSemHora = new Date(
              hoje.getFullYear(),
              hoje.getMonth(),
              hoje.getDate()
            );

            ehGravacaoDeHoje = dataGravacaoSemHora.getTime() === hojeSemHora.getTime();
          } catch (e) {
            console.warn('[retranscreverAudio] Erro ao parsear data:', e);
          }
        }

        if (ehGravacaoDeHoje) {
          audioUrl = `https://delorean.krolik.com.br/records/${codigo}.wav`;
        } else {
          if (calldate && companyCode) {
            try {
              const calldateStr = calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
              const dataGravacao = new Date(calldateStr);
              const ano = dataGravacao.getFullYear();
              const mes = String(dataGravacao.getMonth() + 1).padStart(2, '0');
              const dia = String(dataGravacao.getDate()).padStart(2, '0');
              const dataFormatada = `${ano}-${mes}-${dia}`;
              audioUrl = `https://delorean.krolik.com.br/records/${dataFormatada}/${companyCode}/${codigo}.mp3`;
            } catch (e) {
              console.warn('[retranscreverAudio] Erro ao formatar data para URL MP3:', e);
              audioUrl = `https://delorean.krolik.com.br/records/${codigo}.mp3`;
            }
          } else {
            audioUrl = `https://delorean.krolik.com.br/records/${codigo}.mp3`;
          }
        }
      }

      const response = await fetch(`${this.webhookServerUrl}/api/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioUrl: audioUrl,
          codigo: codigo,
          companyCode: companyCode,
          calldate: gravacao.calldate || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.transcription) {
        const providerNormalizado = (data.provider || 'unknown').toLowerCase();
        this.transcriptions[codigo] = {
          texto: data.transcription || '',
          provider: providerNormalizado,
          model: data.model || 'unknown',
          duration: data.duration || 0,
          requestId: data.requestId || '',
          timestamp: new Date().toISOString()
        };

        this.saveTranscriptionsToStorage();
        this.exibirTranscricao(codigo, index);
      } else {
        throw new Error(data.message || 'Erro desconhecido na transcrição');
      }

    } catch (error) {
      console.error('[retranscreverAudio] ❌ Erro:', error);

      this.mostrarErroTranscricao(codigo, index, error.message);

      this.showTranscriptionErrorModal(error.message);
    } finally {
      delete this.transcribing[codigo];
    }
  }

  async transcreverAudioPorButton(buttonElement) {
    const codigo = buttonElement.getAttribute('data-codigo');
    const index = parseInt(buttonElement.getAttribute('data-index'));
    let companyId = buttonElement.getAttribute('data-company-id');
    const calldate = buttonElement.getAttribute('data-calldate') || '';
    const src = buttonElement.getAttribute('data-src') || '';
    
    if (!companyId && src) {
      const srcString = String(src);
      if (srcString.length >= 3) {
        companyId = srcString.substring(0, 3);
      }
    }
    
    if (!companyId) {
      console.error('[transcreverAudioPorButton] ERRO: company_id não disponível');
      alert('❌ Código da empresa não disponível. Não é possível transcrever.');
      return;
    }

    companyId = String(companyId).trim();

    if (!codigo) {
      alert('❌ Código da gravação não encontrado');
      return;
    }

    try {
      const checkTokenResponse = await fetch(`${this.webhookServerUrl}/api/check-token?companyCode=${encodeURIComponent(companyId)}`);
      if (!checkTokenResponse.ok) {
        throw new Error(`HTTP ${checkTokenResponse.status}`);
      }
      const checkTokenData = await checkTokenResponse.json();
      
      if (!checkTokenData.hasToken) {
        this.showNoTokenModal();
        return;
      }
    } catch (error) {
      console.error('[transcreverAudioPorButton] Erro ao verificar token:', error);
      this.showNoTokenModal();
      return;
    }

    const gravacao = {
      codigo: codigo,
      company_id: companyId,
      calldate: calldate,
      url: '',
      src: src
    };

    this.transcreverAudio(gravacao, index);
  }

  mostrarLoadingTranscricao(codigo, index) {
    const transcricaoElement = document.getElementById(`transcricao-${index}`);
    if (transcricaoElement) {
      transcricaoElement.innerHTML = `
        <div style="color: #c8007e; font-size: 0.95rem; text-align: center; padding: 20px;">
          <div style="display: inline-block; animation: spin 1s linear infinite; font-size: 1.5rem; margin-bottom: 8px;">⏳</div>
          <div>Transcrevendo áudio...</div>
          <div style="font-size: 0.85rem; color: #999; margin-top: 8px;">Isso pode levar alguns segundos</div>
        </div>
        <style>
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        </style>
      `;
    }
  }

  exibirTranscricao(codigo, index) {
    const transcricao = this.transcriptions[codigo];
    if (!transcricao) {
      console.error('[exibirTranscricao] Transcrição não encontrada para código:', codigo);
      return;
    }

    if (!transcricao.texto) {
      console.error('[exibirTranscricao] Texto da transcrição vazio para código:', codigo);
      return;
    }

    const transcricaoElement = document.getElementById(`transcricao-${index}`);
    if (!transcricaoElement) {
      console.error('[exibirTranscricao] Elemento de transcrição não encontrado para índice:', index);
      return;
    }
    
    transcricaoElement.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="color: #c8007e; font-size: 0.9rem; font-weight: 600;">
              📝 Transcrição (${transcricao.provider === 'openai' ? 'OpenAI' : transcricao.provider === 'gemini' ? 'Gemini' : transcricao.provider || 'Unknown'})
            </div>
            <div style="display: flex; gap: 6px;">
              <button 
                onclick="window.clickCallManager.retranscreverAudio('${codigo}', ${index}, event)"
                style="
                  background: rgba(52, 152, 219, 0.8);
                  color: #fff;
                  border: none;
                  border-radius: 6px;
                  padding: 6px 10px;
                  font-size: 1rem;
                  cursor: pointer;
                  transition: background 0.2s;
                  width: 36px;
                  height: 36px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                "
                onmouseover="this.style.background='rgba(52, 152, 219, 1)'"
                onmouseout="this.style.background='rgba(52, 152, 219, 0.8)'"
                title="Retranscrever áudio"
              >
                🔄
              </button>
              <button 
                onclick="copiarTranscricao('${codigo}', ${index}, event)"
                style="
                  background: rgba(123,0,81,0.8);
                  color: #fff;
                  border: none;
                  border-radius: 6px;
                  padding: 6px 10px;
                  font-size: 1rem;
                  cursor: pointer;
                  transition: background 0.2s;
                  width: 36px;
                  height: 36px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                "
                onmouseover="this.style.background='rgba(123,0,81,1)'"
                onmouseout="this.style.background='rgba(123,0,81,0.8)'"
                title="Copiar transcrição"
              >
                📋
              </button>
            </div>
          </div>
          <div style="
            color: #fff;
            font-size: 0.95rem;
            line-height: 1.6;
            text-align: left;
            background: rgba(255,255,255,0.05);
            padding: 12px;
            border-radius: 8px;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            max-height: 300px;
            overflow-y: auto;
          ">${this.escapeHtml(transcricao.texto)}</div>
          <div style="
            color: #999;
            font-size: 0.8rem;
            margin-top: 8px;
            text-align: right;
          ">
            Tempo de processamento: ${this.formatarDuracaoProcessamento(transcricao.duration)}s
          </div>
        `;
  }

  mostrarErroTranscricao(codigo, index, mensagemErro) {
    const transcricaoElement = document.getElementById(`transcricao-${index}`);
    if (transcricaoElement) {
      transcricaoElement.innerHTML = `
          <div style="
            color: #ff6666;
            font-size: 0.9rem;
            text-align: center;
            padding: 16px;
            background: rgba(255,0,0,0.1);
            border-radius: 8px;
            border: 1px solid rgba(255,0,0,0.3);
          ">
            <div style="font-size: 1.2rem; margin-bottom: 8px;">❌</div>
            <div style="font-weight: 600; margin-bottom: 4px;">Erro ao transcrever</div>
            <div style="font-size: 0.85rem; color: #ff9999;">${this.escapeHtml(mensagemErro)}</div>
            <button 
              data-codigo="${codigo}"
              data-index="${index}"
              onclick="window.clickCallManager.transcreverAudioPorButton(this)"
              style="
                margin-top: 12px;
                background: rgba(123,0,81,0.8);
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 8px 16px;
                font-size: 0.85rem;
                cursor: pointer;
              "
            >
              🔄 Tentar Novamente
            </button>
          </div>
        `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatarDuracaoProcessamento(duration) {
    if (!duration) return 'N/A';
    if (typeof duration === 'number') {
      return duration.toFixed(2);
    }
    return String(duration);
  }

  handleDragEnter(e) {
    e.preventDefault();
    this.uploadInput.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.uploadInput.classList.remove('drag-over');
  }

  handleDragOver(e) {
    e.preventDefault();
  }

  handleDrop(e) {
    e.preventDefault();
    this.uploadInput.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.uploadInput.files = files;
      this.handleFileUpload({ target: { files } });
    }
  }

  showLoading(message) {
    this.showMessage(message, 'loading');
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showWarning(message) {
    this.showMessage(message, 'warning');
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  hideLoading() {
    this.hideMessage();
  }

  showMessage(message, type = 'info') {
    this.hideMessage();
    const messageDiv = document.createElement('div');
    messageDiv.className = `toast toast-${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      messageDiv.classList.add('show');
    }, 10);
    if (type !== 'loading') {
      setTimeout(() => this.hideMessage(), 3500);
    }
  }

  hideMessage() {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
  }

  showConfirm(message, onConfirm) {
    const oldModal = document.getElementById('custom-modal-confirm');
    if (oldModal) oldModal.remove();
    const modal = document.createElement('div');
    modal.id = 'custom-modal-confirm';
    modal.className = 'modal-confirm-bg';
    modal.innerHTML = `
      <div class="modal-confirm">
        <div class="modal-confirm-msg">${message}</div>
        <div class="modal-confirm-actions">
          <button class="modal-btn-confirm">Sim</button>
          <button class="modal-btn-cancel">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-btn-confirm').onclick = () => {
      modal.remove();
      onConfirm();
    };
    modal.querySelector('.modal-btn-cancel').onclick = () => {
      modal.remove();
    };
  }

  showTranscriptionErrorModal(errorMessage) {
    const oldModal = document.getElementById('modal-transcricao-erro');
    if (oldModal) oldModal.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-transcricao-erro';
    modal.className = 'modal-confirm-bg';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    const mensagemEscapada = this.escapeHtml(errorMessage || 'Erro desconhecido');
    modal.innerHTML = `
      <div class="modal-confirm" style="
        width: 100%;
        max-width: 500px;
        min-width: 320px;
        box-sizing: border-box;
        background: rgba(40,40,60,0.95);
        backdrop-filter: blur(8px);
        border-radius: 24px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.3);
        padding: 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
      ">
        <div style="
          font-size: 3rem;
          color: #ff4444;
          margin-bottom: 8px;
        ">❌</div>
        <div style="
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          text-align: center;
          margin-bottom: 8px;
        ">Erro ao transcrever áudio</div>
        <div style="
          width: 100%;
          background: rgba(255,68,68,0.1);
          border-left: 4px solid #ff4444;
          border-radius: 8px;
          padding: 16px;
          color: #ffaaaa;
          font-size: 0.95rem;
          line-height: 1.6;
          word-wrap: break-word;
          overflow-wrap: break-word;
          text-align: left;
          max-height: 200px;
          overflow-y: auto;
        ">${mensagemEscapada}</div>
        <button id="close-modal-transcricao-erro" class="modal-btn-confirm" style="
          width: 100%;
          max-width: 200px;
          font-size: 1rem;
          padding: 12px 24px;
          border-radius: 12px;
          background: linear-gradient(90deg, #7b0051 60%, #c8007e 100%);
          color: #fff;
          font-weight: 600;
          border: none;
          box-shadow: 0 2px 8px rgba(123,0,81,0.3);
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">OK</button>
      </div>
    `;
    document.body.appendChild(modal);
    const closeBtn = document.getElementById('close-modal-transcricao-erro');
    closeBtn.onclick = () => {
      modal.remove();
    };
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }

  showNoTokenModal() {
    const oldModal = document.getElementById('modal-no-token');
    if (oldModal) oldModal.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-no-token';
    modal.className = 'modal-confirm-bg';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
      <div class="modal-confirm" style="
        width: 100%;
        max-width: 500px;
        min-width: 320px;
        box-sizing: border-box;
        background: rgba(40,40,60,0.95);
        backdrop-filter: blur(8px);
        border-radius: 24px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.3);
        padding: 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
      ">
        <div style="
          font-size: 3rem;
          color: #ffa500;
          margin-bottom: 8px;
        ">⚠️</div>
        <div style="
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          text-align: center;
          margin-bottom: 8px;
        ">Token não encontrado</div>
        <div style="
          width: 100%;
          background: rgba(255,165,0,0.1);
          border-left: 4px solid #ffa500;
          border-radius: 8px;
          padding: 16px;
          color: #ffd700;
          font-size: 0.95rem;
          line-height: 1.6;
          word-wrap: break-word;
          overflow-wrap: break-word;
          text-align: center;
        ">Não detectamos um token de transcrição, para adquirir entre em contato com o time comercial.</div>
        <button id="close-modal-no-token" class="modal-btn-confirm" style="
          width: 100%;
          max-width: 200px;
          font-size: 1rem;
          padding: 12px 24px;
          border-radius: 12px;
          background: linear-gradient(90deg, #7b0051 60%, #c8007e 100%);
          color: #fff;
          font-weight: 600;
          border: none;
          box-shadow: 0 2px 8px rgba(123,0,81,0.3);
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">OK</button>
      </div>
    `;
    document.body.appendChild(modal);
    const closeBtn = document.getElementById('close-modal-no-token');
    closeBtn.onclick = () => {
      modal.remove();
    };
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }

  formatarDataHora(calldate) {
    if (!calldate || calldate === '') {
      console.warn('[formatarDataHora] calldate vazio ou inválido:', calldate);
      return 'Data não disponível';
    }

    try {

      let dataStr = calldate.toString()
        .replace(/\+/g, ' ')
        .replace(/%3A/g, ':')
        .replace(/%2F/g, '/')
        .replace(/%20/g, ' ')
        .trim();

      let data = new Date(dataStr);

      if (isNaN(data.getTime())) {

        const partes = dataStr.split(/[\s\-:T]/);
        if (partes.length >= 6) {
          const ano = parseInt(partes[0], 10);
          const mes = parseInt(partes[1], 10) - 1;
          const dia = parseInt(partes[2], 10);
          const hora = parseInt(partes[3] || 0, 10);
          const minuto = parseInt(partes[4] || 0, 10);
          const segundo = parseInt(partes[5] || 0, 10);

          if (!isNaN(ano) && !isNaN(mes) && !isNaN(dia)) {
            const dataManual = new Date(ano, mes, dia, hora, minuto, segundo);
            if (!isNaN(dataManual.getTime())) {
              data = dataManual;
            }
          }
        }
      }

      if (!isNaN(data.getTime())) {
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        const hora = String(data.getHours()).padStart(2, '0');
        const minuto = String(data.getMinutes()).padStart(2, '0');
        const segundo = String(data.getSeconds()).padStart(2, '0');
        return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
      }

      console.warn('[formatarDataHora] Não foi possível formatar a data:', calldate, 'dataStr:', dataStr);
      return calldate;
    } catch (e) {
      console.error('[formatarDataHora] Erro ao formatar data:', e, 'calldate:', calldate);
      return calldate;
    }
  }

  formatarDuracao(segundos) {
    if (!segundos || isNaN(segundos)) return '0:00';
    const seg = parseInt(segundos);
    const minutos = Math.floor(seg / 60);
    const segs = seg % 60;
    return `${minutos}:${String(segs).padStart(2, '0')}`;
  }

  showRecordingModal(contact) {
    const oldModal = document.getElementById('modal-gravacao');
    if (oldModal) oldModal.remove();
    const modal = document.createElement('div');
    modal.id = 'modal-gravacao';
    modal.className = 'modal-confirm-bg';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';

    const nomeContato = this.escapeHtml(contact.contato || 'Contato sem nome');
    const telefoneContato = this.escapeHtml(formatarNumeroVisual(contact.numero) || 'Sem telefone');

    this.loadContactsFromStorage();

    const contatoAtualizado = this.contacts.find(c => {
      const ramalMatch = c.ramal && contact.ramal && (
        c.ramal.toString() === contact.ramal.toString() ||
        c.ramal.toString().endsWith(contact.ramal.toString()) ||
        contact.ramal.toString().endsWith(c.ramal.toString())
      );
      const numeroMatch = c.numero && contact.numero && (
        c.numero.toString().replace(/\D/g, '') === contact.numero.toString().replace(/\D/g, '')
      );
      const contatoMatch = c.contato && contact.contato && (
        c.contato.toString().trim() === contact.contato.toString().trim()
      );

      return (ramalMatch || contatoMatch) && numeroMatch;
    }) || contact;

    const gravacoes = (contatoAtualizado.gravacoes || []).length > 0 
      ? contatoAtualizado.gravacoes 
      : null;

    let gravacoesHTML = '';
    if (!gravacoes || gravacoes.length === 0) {
      gravacoesHTML = `
        <div style="
          width: 100%;
          text-align: center;
          padding: 48px 24px;
          color: #ccc;
          font-size: 1.1rem;
        ">
          Nenhuma gravação disponível para este contato
        </div>
      `;
    } else {

      const gravacoesOrdenadas = [...gravacoes].sort((a, b) => {
        const dateA = new Date(a.calldate.replace(/\+/g, ' ').replace(/%3A/g, ':'));
        const dateB = new Date(b.calldate.replace(/\+/g, ' ').replace(/%3A/g, ':'));
        return dateB - dateA; // Mais recente primeiro
      });

              gravacoesHTML = gravacoesOrdenadas.map((gravacao, index) => {

          if (!gravacao.calldate || gravacao.calldate === '') {
            console.warn('[displayGravacoes] Gravacao sem calldate:', {
              codigo: gravacao.codigo,
              gravacaoKeys: Object.keys(gravacao),
              gravacaoCalldate: gravacao.calldate
            });
          }

          const dataFormatada = this.formatarDataHora(gravacao.calldate);       
          const duracaoFormatada = this.formatarDuracao(gravacao.billsec);

        const dispositionValue = 'Atendida';
        const dispositionFormatado = this.escapeHtml(dispositionValue);

        const callidDisplay = gravacao.callid ? ` • CallID: ${this.escapeHtml(gravacao.callid)}` : '';

        let urlGravacao = gravacao.url || '';
        if (!urlGravacao && gravacao.codigo) {

          urlGravacao = `https://delorean.krolik.com.br/services/record/${gravacao.codigo}`;
        }

        let urlGravacaoWav = '';
        let urlGravacaoMp3 = '';
        let ehGravacaoDeHoje = false;

        if (urlGravacao && gravacao.codigo) {

          try {
            if (gravacao.calldate) {

              const calldateStr = gravacao.calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
              const dataGravacao = new Date(calldateStr);
              const hoje = new Date();

              const dataGravacaoSemHora = new Date(dataGravacao.getFullYear(), dataGravacao.getMonth(), dataGravacao.getDate());
              const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

              ehGravacaoDeHoje = dataGravacaoSemHora.getTime() === hojeSemHora.getTime();
            }
          } catch (e) {

            console.warn('[displayGravacoes] Erro ao parsear data da gravação:', e);
            ehGravacaoDeHoje = false;
          }

          urlGravacaoWav = `https://delorean.krolik.com.br/records/${gravacao.codigo}.wav`;
          
          if (ehGravacaoDeHoje) {
            urlGravacaoMp3 = `https://delorean.krolik.com.br/records/${gravacao.codigo}.mp3`;
            urlGravacao = urlGravacaoWav;
          } else {
            if (gravacao.calldate && gravacao.company_id) {
              try {
                const calldateStr = gravacao.calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
                const dataGravacao = new Date(calldateStr);
                const ano = dataGravacao.getFullYear();
                const mes = String(dataGravacao.getMonth() + 1).padStart(2, '0');
                const dia = String(dataGravacao.getDate()).padStart(2, '0');
                const dataFormatada = `${ano}-${mes}-${dia}`;
                urlGravacaoMp3 = `https://delorean.krolik.com.br/records/${dataFormatada}/${gravacao.company_id}/${gravacao.codigo}.mp3`;
              } catch (e) {
                console.warn('[displayGravacoes] Erro ao formatar data para URL MP3:', e);
                urlGravacaoMp3 = `https://delorean.krolik.com.br/records/${gravacao.codigo}.mp3`;
              }
            } else {
              urlGravacaoMp3 = `https://delorean.krolik.com.br/records/${gravacao.codigo}.mp3`;
            }
            urlGravacao = urlGravacaoMp3;
          }
        }

        const urlGravacaoFinal = urlGravacao;
        const urlGravacaoEscapadaParaExibicao = this.escapeHtml(urlGravacao); // Apenas para exibição no link

        return `
          <div class="gravacao-card" style="
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            overflow: hidden;
            word-wrap: break-word;
            overflow-wrap: break-word;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="font-size: 1.2rem; font-weight: 600; color: #fff; margin-bottom: 4px;">
                  📅 ${dataFormatada}
                </div>
                <div style="font-size: 0.95rem; color: #bbb;">
                  Duração: ${duracaoFormatada} • Status: ${dispositionFormatado}${callidDisplay}
                </div>
              </div>
            </div>

            <!-- Player de Áudio Simples -->
            <div class="simple-audio-player" style="width: 100%; max-width: 100%; box-sizing: border-box; margin-bottom: 20px; overflow: hidden;">
              ${urlGravacaoFinal ? `
                <audio id="audio-player-${index}" 
                       data-url="${urlGravacaoFinal}"
                       data-codigo="${gravacao.codigo || ''}"
                       preload="metadata"
                       style="display: none;">
                  ${urlGravacaoWav && urlGravacaoMp3 ? `
                    <!-- Múltiplos sources: o HTML5 audio tenta automaticamente o próximo se o primeiro falhar -->
                    <!-- Prioriza o formato mais provável baseado na data, mas tenta ambos -->
                    ${ehGravacaoDeHoje ? `
                      <source src="${urlGravacaoWav}" type="audio/wav">
                      <source src="${urlGravacaoMp3}" type="audio/mpeg">
                    ` : `
                      <source src="${urlGravacaoMp3}" type="audio/mpeg">
                      <source src="${urlGravacaoWav}" type="audio/wav">
                    `}
                  ` : `
                    <source src="${urlGravacaoFinal}" type="${ehGravacaoDeHoje ? 'audio/wav' : 'audio/mpeg'}">
                  `}
                </audio>

                <!-- Controles do Player -->
                <div style="background: rgba(30,30,45,0.9); border-radius: 12px; padding: 10px 16px; box-sizing: border-box;">
                  <!-- Todos os controles na mesma linha -->
                  <div style="display: flex; align-items: center; gap: 16px; flex-wrap: nowrap;">
                    <!-- Botão Play/Pause -->
                    <button id="play-pause-btn-${index}" class="audio-btn-play" onclick="togglePlayPause(${index})" style="
                      background: rgba(123,0,81,0.8);
                      color: #fff;
                      border: none;
                      border-radius: 50%;
                      width: 48px;
                      height: 48px;
                      font-size: 1.2rem;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      transition: background 0.2s;
                      flex-shrink: 0;
                      font-family: Arial, sans-serif;
                      line-height: 1;
                    " onmouseover="this.style.background='rgba(123,0,81,1)'" onmouseout="this.style.background='rgba(123,0,81,0.8)'">
                      ▶
                    </button>

                    <!-- Barra de Progresso e Tempo -->
                    <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px;">
                      <!-- Barra de Progresso -->
                      <div style="position: relative; width: 100%; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; cursor: pointer;" onclick="seekAudio(event, ${index})" id="progress-container-${index}">
                        <div id="progress-bar-${index}" style="height: 100%; background: rgba(123,0,81,0.8); border-radius: 3px; width: 0%; transition: width 0.1s;"></div>
                      </div>

                      <!-- Tempo -->
                      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #bbb;">
                        <span id="current-time-${index}">0:00</span>
                        <span id="duration-${index}">0:00</span>
                      </div>
                    </div>

                    <!-- Volume Horizontal -->
                    <div class="volume-control-container" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                      <span style="color: #bbb; font-size: 0.85rem;">🔊</span>
                      <input type="range" id="volume-${index}" min="0" max="1" step="0.01" value="1" 
                             class="volume-slider"
                             style="width: 60px; height: 4px; cursor: pointer;" 
                             oninput="setVolume(${index}, this.value)">
                      <span id="volume-text-${index}" class="volume-text" style="color: #bbb; font-size: 0.75rem; min-width: 35px;">100%</span>
                    </div>

                    <!-- Velocidade -->
                    <div style="display: flex; align-items: center; flex-shrink: 0;">
                      <select id="speed-${index}" onchange="setSpeed(${index}, this.value)" style="
                        background: rgba(255,255,255,0.1);
                        color: #fff;
                        border: 1px solid rgba(255,255,255,0.2);
                        border-radius: 6px;
                        padding: 4px 8px;
                        font-size: 0.8rem;
                        cursor: pointer;
                        width: 55px;
                      ">
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>1x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="1.75">1.75x</option>
                        <option value="2">2x</option>
                      </select>
                    </div>
                  </div>
                </div>
              ` : `
                <div style="padding: 12px; background: rgba(255,0,0,0.1); border-radius: 8px; color: #ff6666;">
                  ⚠️ URL da gravação não disponível. Código: ${gravacao.codigo || 'N/A'}
                </div>
              `}
            </div>

            <!-- Área de Transcrição -->
            <div id="transcricao-${index}" style="
              width: 100%;
              max-width: 100%;
              box-sizing: border-box;
              min-height: 80px;
              background: rgba(255,255,255,0.03);
              border-radius: 12px;
              padding: 16px;
              border: 1px dashed rgba(255,255,255,0.2);
              overflow: hidden;
              word-wrap: break-word;
              overflow-wrap: break-word;
              margin-top: 16px;
            ">
              ${this.transcriptions[gravacao.codigo] ? `
                <!-- Transcrição existente -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div style="color: #c8007e; font-size: 0.9rem; font-weight: 600;">
                    📝 Transcrição (${this.transcriptions[gravacao.codigo].provider === 'openai' ? 'OpenAI' : this.transcriptions[gravacao.codigo].provider === 'gemini' ? 'Gemini' : this.transcriptions[gravacao.codigo].provider || 'Unknown'})
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <button 
                      onclick="window.clickCallManager.retranscreverAudio('${this.escapeHtml(gravacao.codigo || '')}', ${index}, event)"
                      style="
                        background: rgba(52, 152, 219, 0.8);
                        color: #fff;
                        border: none;
                        border-radius: 6px;
                        padding: 6px 10px;
                        font-size: 1rem;
                        cursor: pointer;
                        transition: background 0.2s;
                        width: 36px;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                      "
                      onmouseover="this.style.background='rgba(52, 152, 219, 1)'"
                      onmouseout="this.style.background='rgba(52, 152, 219, 0.8)'"
                      title="Retranscrever áudio"
                    >
                      🔄
                    </button>
                    <button 
                      onclick="copiarTranscricao('${this.escapeHtml(gravacao.codigo || '')}', ${index}, event)"
                      style="
                        background: rgba(123,0,81,0.8);
                        color: #fff;
                        border: none;
                        border-radius: 6px;
                        padding: 6px 10px;
                        font-size: 1rem;
                        cursor: pointer;
                        transition: background 0.2s;
                        width: 36px;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                      "
                      onmouseover="this.style.background='rgba(123,0,81,1)'"
                      onmouseout="this.style.background='rgba(123,0,81,0.8)'"
                      title="Copiar transcrição"
                    >
                      📋
                    </button>
                  </div>
                </div>
                <div style="
                  color: #fff;
                  font-size: 0.95rem;
                  line-height: 1.6;
                  text-align: left;
                  background: rgba(255,255,255,0.05);
                  padding: 12px;
                  border-radius: 8px;
                  white-space: pre-wrap;
                  word-wrap: break-word;
                  overflow-wrap: break-word;
                  max-height: 300px;
                  overflow-y: auto;
                ">${this.escapeHtml(this.transcriptions[gravacao.codigo].texto)}</div>
                <div style="
                  color: #999;
                  font-size: 0.8rem;
                  margin-top: 8px;
                  text-align: right;
                ">
                  Tempo de processamento: ${this.formatarDuracaoProcessamento(this.transcriptions[gravacao.codigo].duration)}s
                </div>
              ` : this.transcribing[gravacao.codigo] ? `
                <!-- Loading -->
                <div style="color: #c8007e; font-size: 0.95rem; text-align: center; padding: 20px;">
                  <div style="display: inline-block; animation: spin 1s linear infinite; font-size: 1.5rem; margin-bottom: 8px;">⏳</div>
                  <div>Transcrevendo áudio...</div>
                  <div style="font-size: 0.85rem; color: #999; margin-top: 8px;">Isso pode levar alguns segundos</div>
                </div>
                <style>
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                </style>
              ` : `
                <!-- Botão para transcrever -->
                <div style="text-align: center; padding: 20px;">
                  <div style="color: #999; font-size: 0.9rem; margin-bottom: 12px;">
                    Clique no botão para transcrever o áudio
                  </div>
                  <button 
                    data-codigo="${this.escapeHtml(gravacao.codigo || '')}"
                    data-index="${index}"
                    data-company-id="${this.escapeHtml(gravacao.company_id || '')}"
                    data-calldate="${this.escapeHtml(gravacao.calldate || '')}"
                    data-src="${this.escapeHtml(gravacao.src || '')}"
                    onclick="window.clickCallManager.transcreverAudioPorButton(this)"
                    style="
                      background: linear-gradient(90deg, #7b0051 60%, #c8007e 100%);
                      color: #fff;
                      border: none;
                      border-radius: 12px;
                      padding: 12px 24px;
                      font-size: 1rem;
                      font-weight: 600;
                      cursor: pointer;
                      transition: transform 0.2s, box-shadow 0.2s;
                      box-shadow: 0 2px 8px rgba(123,0,81,0.3);
                    "
                    onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(123,0,81,0.5)'"
                    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(123,0,81,0.3)'"
                    title="Transcrever áudio usando IA"
                  >
                    🎙️ Transcrever Áudio
                  </button>
                </div>
              `}
            </div>
          </div>
        `;
      }).join('');
    }

    modal.innerHTML = `
      <div class="modal-confirm" style="
        width: 100%;
        max-width: 900px;
        height: auto;
        max-height: 85vh;
        min-width: 320px;
        min-height: 320px;
        box-sizing: border-box;
        background: rgba(40,40,60,0.92);
        backdrop-filter: blur(8px);
        border-radius: 32px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.18);
        padding: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        overflow-y: auto;
        overflow-x: hidden;
        margin: 32px 0;
        position: relative;
        scrollbar-width: none;
        -ms-overflow-style: none;
      ">
        <div style="font-size: 2.2rem; font-weight: 700; margin-bottom: 24px; color: #fff; letter-spacing: 0.5px; text-align:center;">
          🎧 Gravações da Ligação
        </div>
        <div style="font-size: 1.1rem; color: #e0e0f0; margin-bottom: 32px; text-align:center;">
          <strong>Contato:</strong> ${nomeContato}<br>
          <strong>Telefone:</strong> ${telefoneContato}
        </div>

        <!-- Lista de Gravações -->
        <div style="width: 100%; max-width: 100%; box-sizing: border-box; margin-bottom: 24px; scrollbar-width: none; -ms-overflow-style: none; overflow-x: hidden;" id="gravacoes-container">
          ${gravacoesHTML}
        </div>

        <button id="close-modal-gravacao" class="modal-btn-confirm" style="
          width: 220px;
          font-size: 1.2rem;
          padding: 14px 28px;
          border-radius: 12px;
          background: linear-gradient(90deg, #7b0051 60%, #c8007e 100%);
          color: #fff;
          font-weight: 600;
          border: none;
          box-shadow: 0 2px 8px rgba(123,0,81,0.08);
          cursor: pointer;
          transition: background 0.2s;
        ">Fechar</button>
        <button id="close-modal-x-gravacao" style="
          position:absolute;
          top:24px;
          right:32px;
          background:transparent;
          border:none;
          font-size:2rem;
          color:#fff;
          cursor:pointer;
          transition: color 0.2s;
        ">&times;</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('close-modal-gravacao').onclick = function() {
      modal.remove();
    };
    document.getElementById('close-modal-x-gravacao').onclick = function() {
      modal.remove();
    };
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };

    function resizeModal() {
      const modalBox = modal.querySelector('.modal-confirm');
      if (!modalBox) return;
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      modalBox.style.maxWidth = Math.min(900, vw * 0.95) + 'px';
      modalBox.style.maxHeight = Math.min(vh * 0.85, 720) + 'px';
    }
    resizeModal();
    window.addEventListener('resize', resizeModal);

    const originalRemove = modal.remove;
    modal.remove = function() {
      window.removeEventListener('resize', resizeModal);
      originalRemove.call(this);
    };

    setTimeout(() => {
      const audioPlayers = modal.querySelectorAll('audio');

      audioPlayers.forEach((audioElement, index) => {
        try {
          const audioId = audioElement.id;
          const playerIndex = index;

          audioElement.load();

          audioElement.addEventListener('loadedmetadata', () => {
            const duration = audioElement.duration || 0;
            const durationEl = document.getElementById(`duration-${playerIndex}`);
            if (durationEl) {
              durationEl.textContent = formatTime(duration);
            }
          });

          audioElement.addEventListener('timeupdate', () => {
            updateProgress(playerIndex);
          });

          audioElement.addEventListener('play', () => {
            const btn = document.getElementById(`play-pause-btn-${playerIndex}`);
            if (btn) btn.innerHTML = '⏸';
          });

          audioElement.addEventListener('pause', () => {
            const btn = document.getElementById(`play-pause-btn-${playerIndex}`);
            if (btn) btn.innerHTML = '▶';
          });

          audioElement.addEventListener('ended', () => {
            const btn = document.getElementById(`play-pause-btn-${playerIndex}`);
            if (btn) btn.innerHTML = '▶';
          });

          audioElement.addEventListener('error', (e) => {
            console.error(`[showRecordingModal] ❌ Player ${playerIndex + 1} - Erro:`, audioElement.error);
          });

          const volumeInput = document.getElementById(`volume-${playerIndex}`);
          if (volumeInput) {
            audioElement.volume = parseFloat(volumeInput.value);
          }

        } catch (error) {
          console.error(`[showRecordingModal] ❌ Erro ao inicializar player simples ${index + 1}:`, error);
        }
      });
    }, 100);
  }

  processWebhookData(body) {

    if (!body) {
      console.error('[processWebhookData] ERRO: Body vazio ou undefined!');
      this.showError('Dados do webhook estão vazios.');
      return;
    }

    try {
      let calldate, src, dst, duration, billsec, disposition, userfield, price, company_id, accountcode, url, callid;

      if (typeof body === 'object' && !Array.isArray(body) && body !== null) {

        calldate = body.calldate || body.call_date || body.date || '';
        src = body.src || '';
        dst = body.dst || '';
        duration = body.duration || '0';
        billsec = body.billsec || '0';
        disposition = body.disposition || '';
        userfield = body.userfield || body.codigo || body.recording_id || body.recording_code || '';
        price = body.price || '0';
        company_id = body.company_id || '';
        accountcode = body.accountcode || '';
        callid = body.callid || ''; // CallID do contato (nome)
        url = body.url || ''; // URL já processada pelo n8n

        if (!userfield && url) {
          const urlMatch = url.match(/\/([^\/]+)\.(wav|mp3|m4a|ogg)$/i);
          if (urlMatch && urlMatch[1]) {
            userfield = urlMatch[1];
          } else {
            const recordMatch = url.match(/\/record[s]?\/?([^\/\?]+)/i);
            if (recordMatch && recordMatch[1]) {
              userfield = recordMatch[1];
            }
          }
        }

        console.log('[processWebhookData] Dados recebidos (JSON):', {
          calldate: calldate,
          userfield: userfield,
          url: url,
          bodyKeys: Object.keys(body),
          bodyCalldate: body.calldate,
          bodyCall_date: body.call_date,
          bodyDate: body.date
        });

      } else if (typeof body === 'string') {

        if (body.trim() === '') {
          console.error('[processWebhookData] ERRO: Body vazio!');
          this.showError('Dados do webhook estão vazios.');
          return;
        }

        const params = new URLSearchParams(body);

        calldate = params.get('calldate') || params.get('call_date') || params.get('date') || '';
        src = params.get('src') || ''; // ramal
        dst = params.get('dst') || ''; // telefone (sem formatação)
        duration = params.get('duration') || '0';
        billsec = params.get('billsec') || '0';
        disposition = params.get('disposition') || '';
        userfield = params.get('userfield') || ''; // código da gravação
        price = params.get('price') || '0';
        company_id = params.get('company_id') || '';
        accountcode = params.get('accountcode') || '';
        callid = params.get('callid') || ''; // CallID do contato (nome)

        url = userfield ? `https://delorean.krolik.com.br/services/record/${userfield}` : '';

        console.log('[processWebhookData] Dados recebidos (String):', {
          calldate: calldate,
          paramsKeys: Array.from(params.keys()),
          paramCalldate: params.get('calldate'),
          paramCall_date: params.get('call_date'),
          paramDate: params.get('date')
        });
      } else {
        console.error('[processWebhookData] ERRO: Formato de dados não reconhecido!');
        console.error('[processWebhookData] Tipo recebido:', typeof body);
        this.showError('Formato de dados do webhook não reconhecido.');
        return;
      }

      if (!src || !dst) {
        console.error('[processWebhookData] ERRO: Campos obrigatórios faltando!');
        console.error('  - src presente?', !!src, 'Valor:', src);
        console.error('  - dst presente?', !!dst, 'Valor:', dst);
        this.showWarning('Webhook recebido com dados incompletos. Verifique o console.');
        return;
      }

      const telefoneFormatado = dst.replace(/\D/g, '');
      const srcString = src ? src.toString() : '';

      const contatoIndex = this.contacts.findIndex((c, idx) => {
        const ramalContato = c.ramal ? c.ramal.toString() : '';
        const numeroContato = c.numero ? c.numero.toString().replace(/\D/g, '') : '';

        const ramalMatchExato = ramalContato === srcString;
        const ramalMatchSufixo = ramalContato.endsWith(srcString) && srcString !== '';
        const ramalMatch = ramalMatchExato || ramalMatchSufixo;

        const numeroMatch = numeroContato === telefoneFormatado;

        return ramalMatch && numeroMatch;
      });

      if (contatoIndex === -1) {
        console.error('[processWebhookData] ERRO: Contato não encontrado!');
        console.error('[processWebhookData] Buscando por ramal:', src, 'telefone:', telefoneFormatado);
        console.error('[processWebhookData] Contatos disponíveis:');
        this.contacts.forEach((c, idx) => {
          console.error(`  [${idx}] ${c.contato || 'sem nome'} - Ramal: ${c.ramal}, Telefone: ${c.numero}`);
        });
        this.showWarning(`Nenhum contato encontrado para ramal ${src} e telefone ${dst}. A gravação não foi vinculada.`);
        return;
      }

      const contatoEncontrado = this.contacts[contatoIndex];

      if (!url && userfield) {
        url = `https://delorean.krolik.com.br/services/record/${userfield}`;
      }

      if (!userfield && url) {
        const urlMatch = url.match(/\/([^\/]+)\.(wav|mp3|m4a|ogg)$/i);
        if (urlMatch && urlMatch[1]) {
          userfield = urlMatch[1];
        } else {
          const recordMatch = url.match(/\/record[s]?\/?([^\/\?]+)/i);
          if (recordMatch && recordMatch[1]) {
            userfield = recordMatch[1];
          }
        }
      }

      if (!userfield) {
        console.warn('[processWebhookData] ATENÇÃO: userfield não encontrado nos dados do webhook');
        console.warn('[processWebhookData] URL:', url);
        console.warn('[processWebhookData] Body completo:', body);
      }

      if (!company_id && src) {
        const srcString = String(src);
        if (srcString.length >= 3) {
          company_id = srcString.substring(0, 3);
        }
      }
      
      if (company_id) {
        company_id = String(company_id).trim();
      }

      if (!company_id) {
        console.error('[processWebhookData] ERRO: company_id não encontrado nos dados do webhook e não foi possível extrair do ramal');
        console.error('[processWebhookData] Body completo:', body);
        this.showError('Código da empresa (company_id) não encontrado nos dados do webhook. Não é possível processar a gravação.');
        return;
      }

      const dispositionNormalizado = 'Atendida';

      const gravacao = {
        codigo: userfield,
        calldate: calldate || '',
        src: src,
        dst: dst,
        duration: duration || '0',
        billsec: billsec || '0',
        disposition: dispositionNormalizado,
        callid: callid || '', // Armazenar callid (nome do contato)
        url: url,
        price: price || '0',
        company_id: company_id,
        accountcode: accountcode || ''
      };

      console.log('[processWebhookData] Objeto de gravação criado:', {
        codigo: gravacao.codigo,
        calldate: gravacao.calldate,
        calldateTipo: typeof gravacao.calldate,
        calldateVazio: !gravacao.calldate || gravacao.calldate === ''
      });

      if (!this.contacts[contatoIndex].gravacoes) {
        this.contacts[contatoIndex].gravacoes = [];
      }

      const existeGravacao = this.contacts[contatoIndex].gravacoes.some(g => g.codigo === userfield);

      if (!existeGravacao) {
        this.contacts[contatoIndex].gravacoes.unshift(gravacao); // Adiciona no início

        try {
          this.saveContactsToStorage();

          this.updateRecordingIcon(contatoIndex);
        } catch (saveError) {
          console.error('[processWebhookData] ERRO ao salvar no localStorage:', saveError);
        }

        const nomeContato = this.contacts[contatoIndex].contato || 'Contato sem nome';
        this.showSuccess(`Gravação adicionada ao contato: ${nomeContato}`);
      } else {
        this.showWarning('Esta gravação já foi registrada anteriormente.');
      }
    } catch (error) {
      console.error('[processWebhookData] ERRO ao processar webhook:', error);
      this.showError('Erro ao processar dados do webhook. Verifique o console para mais detalhes.');
    }
  }

  handleWebhookRequest(body) {

    if (!body) {
      console.error('[handleWebhookRequest] ERRO: Body vazio ou undefined!');
      this.showError('Webhook recebido sem dados. Body está vazio.');
      return;
    }

    if (typeof body === 'string') {
      this.processWebhookData(body);
    } else if (body && body.formData) {

      const formData = body.formData;
      const params = new URLSearchParams();
      for (const [key, value] of formData.entries()) {
        params.append(key, value);
      }
      const formDataString = params.toString();
      this.processWebhookData(formDataString);
    } else if (body && typeof body === 'object' && !Array.isArray(body)) {

      if (body.url) {

        this.processWebhookData(body);
      } else {

        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(body)) {
          params.append(key, value);
        }
        const objectString = params.toString();
        this.processWebhookData(objectString);
      }
    } else {
      console.error('[handleWebhookRequest] ERRO: Formato de dados do webhook não reconhecido!');
      this.showError('Formato de dados do webhook não reconhecido.');
    }
  }

  testWebhook(testData) {

    if (!testData) {

      testData = 'calldate=2025-10-29+11%3A29%3A03&src=1001099&dst=16981317956&duration=15&billsec=12&disposition=ANSWERED&userfield=20251029_112915_1001099_103_16981317956_1761748146&price=0.105&company_id=100&accountcode=5.00';
    }
    this.handleWebhookRequest(testData);
  }

  setupWebhookListener() {

    window.receberWebhook = (body) => {

      if (this && typeof this.handleWebhookRequest === 'function') {
        this.handleWebhookRequest(body);
      } else {
        console.error('[setupWebhookListener] ERRO: ClickCallManager não está inicializado!');
        console.error('[setupWebhookListener] this:', this);
        console.error('[setupWebhookListener] typeof this:', typeof this);
      }
    };

    window.addEventListener('webhook-received', (event) => {

      if (event.detail && event.detail.body) {
        this.handleWebhookRequest(event.detail.body);
      } else {
        console.error('[setupWebhookListener] ERRO: Evento sem body válido!');
        console.error('[setupWebhookListener] event.detail:', event.detail);
      }
    });

  }

  startWebhookPolling() {

    if (this.webhookPollingIntervalId) {
      clearInterval(this.webhookPollingIntervalId);
      this.webhookPollingIntervalId = null;
    }

    const webhookServerUrl = this.webhookServerUrl || 'http://localhost:4201';
    const pollingInterval = this.webhookPollingInterval || 5000; // 5 segundos por padrão

    let lastWebhookTimestamp = null;

    const fetchWebhook = async () => {
      try {
        const url = `${webhookServerUrl}/api/get-latest-webhook`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json();

        if (result.success && result.data && result.timestamp !== lastWebhookTimestamp) {

          lastWebhookTimestamp = result.timestamp;

          let dataToProcess = result.data;

          if (result.source === 'n8n_processed') {

            if (typeof dataToProcess === 'string') {
              try {
                dataToProcess = JSON.parse(dataToProcess);
              } catch (e) {
                console.error('[startWebhookPolling] ❌ ERRO ao fazer parse JSON:', e);
              }
            } else if (typeof dataToProcess === 'object') {
            }
          } else if (result.source === 'delorean_raw') {

            if (typeof dataToProcess === 'object') {

              const params = new URLSearchParams();
              Object.keys(dataToProcess).forEach(key => {
                params.append(key, dataToProcess[key]);
              });
              dataToProcess = params.toString();
            }
          }

          if (typeof dataToProcess === 'object') {
          }

          if (typeof this.handleWebhookRequest === 'function') {
            this.handleWebhookRequest(dataToProcess);
          } else {
            console.error('[startWebhookPolling] ❌ ERRO: handleWebhookRequest não está disponível!');
          }
        } else if (!result.success) {

          if (result.message !== 'Nenhum webhook recebido ainda') {
          }
        }
      } catch (error) {

        if (!this._webhookConnectionErrorLogged) {
          console.warn('[startWebhookPolling] ⚠️  Servidor de webhook não acessível. Verifique se o backend está rodando.');
          console.warn('[startWebhookPolling] URL tentada:', webhookServerUrl);
          console.warn('[startWebhookPolling] Erro:', error.message);
          this._webhookConnectionErrorLogged = true;
        }
      }
    };

    fetchWebhook();

    this.webhookPollingIntervalId = setInterval(fetchWebhook, pollingInterval);

  }

  stopWebhookPolling() {
    if (this.webhookPollingIntervalId) {
      clearInterval(this.webhookPollingIntervalId);
      this.webhookPollingIntervalId = null;
    }
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
      this.showWarning('Nenhum arquivo selecionado');
      return;
    }
    if (!this.isValidFileType(file)) {
      this.showError('Tipo de arquivo não suportado. Use arquivos .xlsx ou .csv');
      return;
    }
    try {
      this.showLoading('Processando arquivo...');
      const contacts = await this.processFile(file);
      const hash = JSON.stringify(contacts);

      if (this.contacts && this.contacts.length > 0 && this._lastImportHash) {
        if (this._lastImportHash === hash && this._lastImportFileName === file.name) {
          this.hideLoading();
          this.showWarning('A planilha enviada é idêntica à última importada (nome e conteúdo iguais). Nenhuma ação foi realizada.');
          return;
        } else if (this._lastImportHash === hash && this._lastImportFileName !== file.name) {
          this.hideLoading();
          this.showWarning('O conteúdo da planilha enviada é idêntico ao da última importada, mas o nome do arquivo é diferente. Nenhuma ação foi realizada.');
          return;
        }
      }
      this._lastImportHash = hash;
      this._lastImportFileName = file.name;
      this.hideLoading();
      if (contacts.length === 0) {
        this.showWarning('Nenhum contato válido encontrado no arquivo. Verifique se há colunas com NOME/CONTATO, RAMAL ou TELEFONE/NUMERO.');
        return;
      }
      this.showImportOptions(contacts);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      this.showError(`Erro ao processar o arquivo: ${error.message}`);
      this.hideLoading();
    }
  }

  isValidFileType(file) {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    return validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.csv');
  }

  async processFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet);
          if (!json || json.length === 0) {
            reject(new Error('Arquivo vazio ou sem dados válidos'));
            return;
          }
          const contacts = this.normalizeContacts(json);
          resolve(contacts);
        } catch (error) {
          console.error('Erro ao processar arquivo:', error);
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  normalizeContacts(contacts) {

    return contacts.map((contact, index) => {

      const getValue = (keys) => {
        for (let key of keys) {
          if (contact[key] !== undefined && contact[key] !== null && contact[key] !== '') {
            return contact[key];
          }
        }
        return '';
      };

      const cpfOriginal = getValue(['CPF / CNPJ', 'CPF', 'cpf', 'CNPJ', 'cnpj']);
      let cpfFormatado = '';

      if (cpfOriginal) {
        cpfFormatado = formatarCpfCnpj(cpfOriginal);

        if (cpfOriginal.replace(/\D/g, '').length === 11 && validarCpfCnpj(cpfOriginal)) {
          if (cpfOriginal !== cpfFormatado) {
          }
        } else {

          cpfFormatado = cpfOriginal;
          if (cpfOriginal.replace(/\D/g, '').length > 0) {
          }
        }
      }

      const normalized = {
        contato: getValue(['CONTATO', 'contato', 'Contato', 'NOME', 'Nome', 'nome', 'PESSOA', 'Pessoa', 'pessoa', 'CLIENTE', 'Cliente', 'cliente']),
        cpf: cpfFormatado,
        ramal: getValue(['RAMAL', 'ramal', 'Ramal']),
        numero: getValue(['TELEFONE', 'telefone', 'Telefone', 'NUMERO', 'numero', 'Numero', 'FONE', 'fone', 'Fone']),
        done: false,
        observacao: getValue(['OBSERVAÇÃO', 'observacao', 'Observação', 'OBSERVACAO', 'OBS', 'obs', 'Obs']),
        gravacoes: [] // Inicializa array de gravações vazio
      };

      const jaLiguei = getValue(['JÁ LIGUEI', 'já liguei', 'JÁ LIGUEI', 'done', 'Done', 'DONE']);
      if (jaLiguei) {
        normalized.done = jaLiguei.toString().toLowerCase() === 'sim' || 
                         jaLiguei.toString().toLowerCase() === 'true' || 
                         jaLiguei.toString().toLowerCase() === '1' ||
                         jaLiguei === true;
      }

      return normalized;
    }).filter(contact => {

      const temContato = contact.contato && contact.contato.toString().trim() !== '';
      const temRamal = contact.ramal && contact.ramal.toString().trim() !== '';
      const temNumero = contact.numero && contact.numero.toString().trim() !== '';

      const valido = temContato || temRamal || temNumero;
      if (!valido) {
      }
      return valido;
    });
  }

  displayContacts(contacts) {
    const tbody = this.contactsTable.querySelector('tbody');
    if (!tbody) throw new Error('Elemento tbody não encontrado');
    tbody.innerHTML = '';
    const total = contacts.length;
    const totalPages = Math.max(1, Math.ceil(total / this.contactsPerPage));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const start = (this.currentPage - 1) * this.contactsPerPage;
    const end = start + this.contactsPerPage;
    const pageContacts = contacts.slice(start, end);
    if (pageContacts.length === 0) {
      this.showEmptyState(tbody);
    } else {
      pageContacts.forEach((contact, index) => {
        const row = this.createContactRow(contact, start + index);
        tbody.appendChild(row);
      });
      this.animateTableRows();
    }
    this.renderPagination(totalPages);
  }

  updateRecordingIcon(contatoIndex) {
    const tbody = this.contactsTable.querySelector('tbody');
    if (!tbody) return;

    const contact = this.contacts[contatoIndex];
    if (!contact) return;

    const total = this.contacts.length;
    const contactsPerPage = this.contactsPerPage;

    let pageIndex = -1;
    let pageNum = 1;
    let currentCount = 0;

    for (let i = 0; i < this.contacts.length; i++) {
      if (i === contatoIndex) {
        pageIndex = currentCount;
        break;
      }
      currentCount++;
      if (currentCount >= contactsPerPage) {
        pageNum++;
        currentCount = 0;
      }
    }

    if (pageNum !== this.currentPage) {
      return;
    }

    const rows = tbody.querySelectorAll('tr');
    if (pageIndex >= 0 && pageIndex < rows.length) {
      const row = rows[pageIndex];
      const gravarCell = row.querySelector('.td-gravacao');

      if (gravarCell) {

        const temContato = contact.contato && contact.contato.trim() !== '';
        const hasRecordings = contact.gravacoes && contact.gravacoes.length > 0;

        if (temContato && hasRecordings) {

          if (!gravarCell.querySelector('.gravar-btn')) {

            const btn = document.createElement('button');
            btn.className = 'gravar-btn';
            btn.title = 'Ver gravações';
            btn.innerHTML = '🎧';
            btn.onclick = () => this.showRecordingModal(contact);
            gravarCell.innerHTML = '';
            gravarCell.appendChild(btn);
          }
        } else {

          if (gravarCell.querySelector('.gravar-btn')) {
            gravarCell.innerHTML = '<span style="color: #ccc; font-size: 0.9rem;">—</span>';
          }
        }
      }
    }
  }

  handleDeleteContact(index) {
    const contato = this.contacts[index];
    const nome = contato && contato.contato ? ` (${contato.contato})` : '';
    this.showConfirm(`Tem certeza que deseja remover este contato${nome}? Essa ação não pode ser desfeita.`, () => {
      this.contacts.splice(index, 1);
      this.saveContactsToStorage();
      if (this.currentPage > 1 && (this.contacts.length % this.contactsPerPage === 0)) {
        this.currentPage--;
      }
      this.applySortAndDisplay();
      this.showSuccess('Contato removido com sucesso!');
    });
  }

  showImportOptions(importedContacts) {
    if (!this.contacts || this.contacts.length === 0) {

      this.replaceContacts(importedContacts);
      return;
    }
    const oldModal = document.getElementById('custom-modal-import');
    if (oldModal) oldModal.remove();
    const modal = document.createElement('div');
    modal.id = 'custom-modal-import';
    modal.className = 'modal-confirm-bg';
    modal.innerHTML = `
      <div class="modal-confirm">
        <div class="modal-confirm-msg">Como deseja importar os contatos?<br><br>
          <b>Mesclar</b>: adiciona os contatos importados aos já existentes.<br>
          <b>Substituir</b>: apaga todos os contatos atuais e importa apenas os novos.
        </div>
        <div class="modal-confirm-actions">
          <button class="modal-btn-confirm" id="btn-import-merge">Mesclar</button>
          <button class="modal-btn-confirm" id="btn-import-replace">Substituir</button>
          <button class="modal-btn-cancel">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#btn-import-merge').onclick = () => {
      modal.remove();
      this.mergeContacts(importedContacts);
    };
    modal.querySelector('#btn-import-replace').onclick = () => {
      modal.remove();
      this.replaceContacts(importedContacts);
    };
    modal.querySelector('.modal-btn-cancel').onclick = () => {
      modal.remove();
    };
  }

  mergeContacts(importedContacts) {

    const ramaisExistentes = new Set(this.contacts.map(c => c.ramal).filter(r => r));

    const novos = importedContacts.filter(c => {
      const temRamal = c.ramal && c.ramal.toString().trim() !== '';
      const ramalNovo = !ramaisExistentes.has(c.ramal);
      return temRamal && ramalNovo;
    });

    this.contacts = [...this.contacts, ...novos];
    this.saveContactsToStorage();
    this.currentPage = 1;
    this.applySortAndDisplay();
    this.showSuccess(`${novos.length} contatos importados e mesclados com sucesso!`);
  }

  replaceContacts(importedContacts) {

    this.contacts = importedContacts;
    this.saveContactsToStorage();
    this.currentPage = 1;
    this.applySortAndDisplay();
    this.showSuccess(`${importedContacts.length} contatos substituídos com sucesso!`);
  }

  handleEditContact(tr, contact, index) {
    if (tr.classList.contains('edit-mode')) return;
    tr.classList.add('edit-mode');

    const CONTATO = contact.contato || '';
    const CPF = contact.cpf || '';
    const RAMAL = contact.ramal || '';
    const TELEFONE = contact.numero || '';

    tr.querySelector('.td-contato').innerHTML = `<input type='text' value='${this.escapeHtml(CONTATO)}' style='width:100%'>`;
    tr.querySelector('.td-cpf').innerHTML = `<input type='text' value='${this.escapeHtml(CPF)}' maxlength='18' style='width:100%'>`;
    tr.querySelector('.td-ramal').innerHTML = `<input type='text' value='${this.escapeHtml(RAMAL)}' style='width:100%'>`;
    tr.querySelector('.td-numero').innerHTML = `<input type='text' value='${this.escapeHtml(TELEFONE)}' style='width:100%'>`;

    const tdAcao = tr.querySelector('.td-acao');
    tdAcao.innerHTML = '';
    const btnSalvar = this.createButton('Salvar', 'save-btn');
    const btnCancelar = this.createButton('Cancelar', 'cancel-btn');
    tdAcao.appendChild(btnSalvar);
    tdAcao.appendChild(btnCancelar);

    const cpfInput = tr.querySelector('.td-cpf input');
    cpfInput.addEventListener('input', function() {
      this.value = formatarCpfCnpj(this.value);
    });
    btnSalvar.onclick = () => {
      const novoCONTATO = tr.querySelector('.td-contato input').value.trim();
      const novoCPF = tr.querySelector('.td-cpf input').value.trim();
      const novoRAMAL = tr.querySelector('.td-ramal input').value.trim();
      const novoTELEFONE = tr.querySelector('.td-numero input').value.trim();
      if (!novoCONTATO || !novoRAMAL || !novoTELEFONE) {
        this.showWarning('Preencha todos os campos obrigatórios: CONTATO, RAMAL e TELEFONE.');
        return;
      }
      if (!/^[0-9]{7,}$/.test(novoRAMAL)) {
        this.showError('O campo RAMAL deve conter apenas números e ter pelo menos 7 dígitos.');
        return;
      }
      if (!/^[0-9]{8,}$/.test(novoTELEFONE)) {
        this.showError('O campo TELEFONE deve conter apenas números e ter pelo menos 8 dígitos.');
        return;
      }
      if (novoCPF && !validarCpfCnpj(novoCPF)) {
        this.showError('CPF ou CNPJ inválido.');
        return;
      }
      contact.contato = novoCONTATO;
      contact.cpf = novoCPF;
      contact.ramal = novoRAMAL;
      contact.numero = novoTELEFONE;
      this.saveContactsToStorage();
      this.applySortAndDisplay();
    };
    btnCancelar.onclick = () => {
      this.applySortAndDisplay();
    };
  }

}

function formatarCpfCnpj(valor) {
  if (!valor) return '';
  valor = valor.toString().replace(/\D/g, '');
  if (valor.length <= 11) {

    if (valor.length === 11) {
      return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return valor;
  } else {

    valor = valor.substring(0, 14); // Limita a 14 dígitos
    return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
}

function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^([0-9])\1+$/.test(cnpj)) return false;
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado != digitos.charAt(0)) return false;
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado != digitos.charAt(1)) return false;
  return true;
}

function validarCpfCnpj(valor) {
  valor = valor.replace(/\D/g, '');
  if (valor.length === 11) return true; // Aceita qualquer CPF com 11 dígitos
  if (valor.length === 14) return true; // Aceita qualquer CNPJ com 14 dígitos
  return false;
}

function formatarNumeroVisual(numero) {
  if (!numero) return '';
  const num = numero.toString().replace(/\D/g, '');
  if (num.length === 11) {

    return `(${num.substr(0,2)}) ${num.substr(2,5)}-${num.substr(7,4)}`;
  } else if (num.length === 10) {

    return `(${num.substr(0,2)}) ${num.substr(2,4)}-${num.substr(6,4)}`;
  } else if (num.length === 9) {

    return `${num.substr(0,5)}-${num.substr(5,4)}`;
  } else if (num.length === 8) {

    return `${num.substr(0,4)}-${num.substr(4,4)}`;
  }
  return numero; // Retorna como está se não bater nenhum padrão
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function togglePlayPause(index) {
  const audio = document.getElementById(`audio-player-${index}`);
  if (!audio) {
    console.error(`[togglePlayPause] Áudio ${index} não encontrado`);
    return;
  }

  if (audio.paused) {
    audio.play().catch(err => {
      console.error(`[togglePlayPause] Erro ao reproduzir áudio:`, err);
    });
  } else {
    audio.pause();
  }
}

function updateProgress(index) {
  const audio = document.getElementById(`audio-player-${index}`);
  if (!audio) return;

  const currentTime = audio.currentTime || 0;
  const duration = audio.duration || 0;

  const progressBar = document.getElementById(`progress-bar-${index}`);
  if (progressBar && duration > 0) {
    const percent = (currentTime / duration) * 100;
    progressBar.style.width = percent + '%';
  }

  const currentTimeEl = document.getElementById(`current-time-${index}`);
  if (currentTimeEl) {
    currentTimeEl.textContent = formatTime(currentTime);
  }
}

function seekAudio(event, index) {
  const audio = document.getElementById(`audio-player-${index}`);
  const container = document.getElementById(`progress-container-${index}`);
  if (!audio || !container) return;

  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const percent = x / rect.width;
  const duration = audio.duration || 0;

  if (duration > 0) {
    audio.currentTime = percent * duration;
    updateProgress(index);
  }
}

function setVolume(index, value) {
  const audio = document.getElementById(`audio-player-${index}`);
  if (!audio) return;

  const volume = parseFloat(value);
  audio.volume = volume;

  const volumeText = document.getElementById(`volume-text-${index}`);
  if (volumeText) {
    volumeText.textContent = Math.round(volume * 100) + '%';
  }
}

function setSpeed(index, value) {
  const audio = document.getElementById(`audio-player-${index}`);
  if (!audio) return;

  const speed = parseFloat(value);
  audio.playbackRate = speed;
}

async function downloadAudio(url, filename) {
  try {

    if (window.clickCallManager && window.clickCallManager.showWarning) {
      window.clickCallManager.showWarning('Preparando download...');
    }

    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar arquivo: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();

    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);

    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);

    if (window.clickCallManager && window.clickCallManager.showSuccess) {
      window.clickCallManager.showSuccess(`Download iniciado: ${filename}`);
    }

  } catch (error) {
    console.error('[downloadAudio] ❌ Erro ao fazer download:', error);

    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 100);

      if (window.clickCallManager && window.clickCallManager.showWarning) {
        window.clickCallManager.showWarning('Tentando método alternativo de download...');
      }
    } catch (fallbackError) {
      console.error('[downloadAudio] ❌ Fallback também falhou:', fallbackError);

      window.open(url, '_blank');

      if (window.clickCallManager && window.clickCallManager.showWarning) {
        window.clickCallManager.showWarning('Não foi possível iniciar o download automaticamente. Abrindo em nova aba... (Você pode fazer o download manualmente clicando com botão direito → Salvar como)');
      }
    }
  }
}

function copiarTranscricao(codigo, index, event) {
  const manager = window.clickCallManager;
  if (!manager) {
    console.error('[copiarTranscricao] clickCallManager não encontrado');
    alert('❌ Erro: Sistema não inicializado');
    return;
  }

  const transcricao = manager.transcriptions[codigo];

  if (!transcricao) {
    alert('❌ Transcrição não encontrada');
    return;
  }

  navigator.clipboard.writeText(transcricao.texto).then(() => {

    const button = event ? event.target : event.currentTarget;
    if (button) {
      const textoOriginal = button.innerHTML;
      button.innerHTML = '✅ Copiado!';
      button.style.background = 'rgba(0,255,0,0.8)';

      setTimeout(() => {
        button.innerHTML = textoOriginal;
        button.style.background = 'rgba(123,0,81,0.8)';
      }, 2000);
    }
  }).catch(err => {
    console.error('[copiarTranscricao] Erro:', err);
    alert('❌ Erro ao copiar transcrição. Tente selecionar o texto manualmente.');
  });
}

function initializeClickCall() {

  if (window.clickCallManager && typeof window.clickCallManager.stopWebhookPolling === 'function') {
    window.clickCallManager.stopWebhookPolling();
  }

  window.clickCallManager = new ClickCallManager();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeClickCall);
} else {
  initializeClickCall();
}