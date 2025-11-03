class ClickCallManager {
  constructor() {
    this.uploadInput = null;
    this.contactsTable = null;
    this.contacts = [];
    this.isInitialized = false;
    this.addButton = null;
    this.localStorageKey = 'clickcall_contatos';
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
    
    // Configuração do servidor de webhook (backend local)
    this.webhookServerUrl = 'http://localhost:4201'; // Backend local onde o webhook-server.js está rodando
    this.webhookPollingInterval = 5000; // 5 segundos (ajustável)
    this.webhookPollingIntervalId = null;
    this._webhookConnectionErrorLogged = false;
    
    this.init();
  }

  /**
   * Inicializa a aplicação
   */
  async init() {
    try {
      // Aguarda dependências externas (XLSX e DOM pronto) antes de iniciar
      await this.waitForDependencies();
      this.setupElements();
      this.loadContactsFromStorage();
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

  /**
   * Aguarda o carregamento das dependências externas (XLSX e DOM)
   */
  async waitForDependencies() {
    return new Promise((resolve, reject) => {
      const maxAttempts = 50;
      let attempts = 0;
      const checkDependencies = () => {
        attempts++;
        // Só prossegue se XLSX já está disponível e o DOM está pronto
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

  /**
   * Cria e posiciona dinamicamente todos os elementos da interface (inputs, botões, selects, etc)
   * Isso permite que o HTML fique limpo e a ordem dos elementos seja controlada por código.
   */
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

  // Cria um input do tipo especificado
  createInput(type, placeholder, className) {
    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    input.className = className;
    return input;
  }

  // Cria um botão com texto e classe
  createButton(text, className) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = className;
    return btn;
  }

  // Cria um select (dropdown) com opções
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

  /**
   * Adiciona eventos de clique nos cabeçalhos para ordenação dinâmica
   */
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

  /**
   * Aplica ordenação e exibe os contatos filtrados/paginados
   */
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

  /**
   * Vincula todos os eventos dos elementos dinâmicos
   */
  bindEvents() {
    this.uploadInput.addEventListener('change', this.handleFileUpload.bind(this));
    this.addButton.addEventListener('click', this.handleAddContact.bind(this));
    this.exportButton.addEventListener('click', this.handleExport.bind(this));
    this.searchInput.addEventListener('input', this.handleSearch.bind(this));
    // O evento do seletor de itens por página é adicionado dinamicamente em renderPagination
    // para garantir que o elemento exista no DOM
    this.uploadInput.addEventListener('dragenter', this.handleDragEnter.bind(this));
    this.uploadInput.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.uploadInput.addEventListener('dragover', this.handleDragOver.bind(this));
    this.uploadInput.addEventListener('drop', this.handleDrop.bind(this));
  }

  // Manipula a exportação dos contatos
  handleExport() {
    const format = this.exportSelect.value;
    
    // Para exportações, verifica se há contatos
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
    
    // Gera data e hora atuais no formato DD-MM-YYYY_HH-mm
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

  // Exporta tabela padrão (template) para o usuário preencher
  exportTemplate() {
    // Cria dados de exemplo para mostrar o formato correto
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

    // Cria a planilha com os dados de exemplo
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Adiciona formatação e validação
    this.addTemplateFormatting(ws);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Contatos');
    
    // Adiciona uma aba de instruções
    this.addInstructionsSheet(wb);
    
    // Gera nome do arquivo
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const dateStr = `${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const fileName = `ClickCall_Template(${dateStr}).xlsx`;
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    this.downloadFile(blob, fileName);
    
    this.showSuccess('Tabela padrão exportada com sucesso! Preencha os dados e importe novamente.');
  }

  // Adiciona formatação à planilha template
  addTemplateFormatting(ws) {
    // Define larguras das colunas
    const colWidths = [
      { wch: 25 }, // CONTATO
      { wch: 18 }, // CPF / CNPJ
      { wch: 12 }, // RAMAL
      { wch: 15 }, // TELEFONE
      { wch: 10 }, // JÁ LIGUEI
      { wch: 30 }  // OBSERVAÇÃO
    ];
    ws['!cols'] = colWidths;
    
    // Define estilos para o cabeçalho (primeira linha)
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

  // Adiciona aba de instruções ao template
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
    
    // Formata a aba de instruções
    const instructionRange = XLSX.utils.decode_range(wsInstructions['!ref']);
    for (let row = instructionRange.s.r; row <= instructionRange.e.r; row++) {
      for (let col = instructionRange.s.c; col <= instructionRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (wsInstructions[cellAddress]) {
          if (row === 0) {
            // Título principal
            wsInstructions[cellAddress].s = {
              font: { bold: true, size: 14, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '2E75B6' } },
              alignment: { horizontal: 'center' }
            };
          } else if (row === 2 || row === 7 || row === 12 || row === 18) {
            // Subtítulos
            wsInstructions[cellAddress].s = {
              font: { bold: true, color: { rgb: '2E75B6' } },
              fill: { fgColor: { rgb: 'D9E2F3' } }
            };
          }
        }
      }
    }
    
    // Define largura das colunas da aba de instruções
    wsInstructions['!cols'] = [{ wch: 80 }];
    
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções');
  }

  /**
   * Faz o download de um arquivo no navegador
   */
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

  // Carrega os contatos do localStorage
  loadContactsFromStorage() {
    const data = localStorage.getItem(this.localStorageKey);
    if (data) {
      try {
        this.contacts = JSON.parse(data);
        
        // Migração: adicionar campo gravacoes[] se não existir
        this.contacts = this.contacts.map((contact, index) => {
          if (!contact.gravacoes) {
            contact.gravacoes = [];
          }
          // Log para debug de gravações
          if (contact.gravacoes && contact.gravacoes.length > 0) {
          }
          return contact;
        });
        
        // Contar total de gravações
        const totalGravacoes = this.contacts.reduce((total, c) => total + (c.gravacoes?.length || 0), 0);
        
        // Salvar após migração se houver alterações
        this.saveContactsToStorage();
      } catch (e) {
        console.error('[loadContactsFromStorage] ERRO ao carregar contatos:', e);
        this.contacts = [];
      }
    } else {
    }
  }

  // Salva os contatos no localStorage
  saveContactsToStorage() {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.contacts));
  }

  // Manipula a busca na lista de contatos
  handleSearch() {
    const term = this.searchInput.value.trim().toLowerCase();
    this.currentPage = 1;
    if (!term) {
      this.filteredContacts = null;
      this.applySortAndDisplay();
      return;
    }
    // Para busca de CPF sem pontuação
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

  // Manipula a adição manual de um novo contato
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

    // Máscara dinâmica para CPF
    const cpfInput = tr.children[1].querySelector('input');
    cpfInput.addEventListener('input', function() {
      this.value = formatarCpfCnpj(this.value);
    });

    // Textarea dinâmica para observação
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

  /**
   * Renderiza a paginação e posiciona o seletor de itens por página à direita
   * O seletor é criado apenas uma vez e reaproveitado
   */
  renderPagination(totalPages) {
    if (!this.paginationDiv) return;
    this.paginationDiv.innerHTML = '';
    // Renderiza botões de navegação apenas se houver mais de uma página
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
      // Mesmo com uma página, mostra o texto de página
      const pageInfo = document.createElement('span');
      pageInfo.textContent = `Página 1 de 1`;
      this.paginationDiv.appendChild(pageInfo);
    }
    // O seletor de itens por página deve ser sempre exibido
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

  // Manipula a mudança de itens por página
  handlePerPageChange() {
    this.contactsPerPage = parseInt(this.perPageSelect.value, 10);
    this.currentPage = 1;
    this.applySortAndDisplay();
  }

  // Cria uma linha de contato na tabela
  createContactRow(contact, index) {
    const tr = document.createElement('tr');
    tr.className = 'contact-row';
    // Ordem: CONTATO, CPF, RAMAL, TELEFONE, JÁ LIGUEI, AÇÃO, OBSERVAÇÃO, GRAVAÇÃO
    const callLink = this.createCallLink(contact.ramal, contact.numero, contact.contato);
    // Verifica se o contato tem um contato para mostrar o ícone de gravação
    // O ícone só aparece se o contato tiver um nome (contato)
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
      // Busca o índice real do contato no array principal usando ramal + telefone como chave
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
    // Botão de gravação: abre modal com áudio e transcrição
    const btnGravacao = tr.querySelector('.gravar-btn');
    if (btnGravacao) {
      btnGravacao.onclick = () => {
        // Busca o contato completo do array principal para garantir que temos todos os dados
        const realIndex = this.contacts.findIndex(c => 
          c.ramal === contact.ramal && 
          c.numero === contact.numero && 
          c.contato === contact.contato
        );
        const contatoCompleto = realIndex !== -1 ? this.contacts[realIndex] : contact;
        this.showRecordingModal(contatoCompleto);
      };
    }
    // Observação: só mostra textarea ao clicar
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
      // Salvar ao pressionar Enter
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          salvarObs();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelarObs();
        }
      });
      // Cria os botões Salvar/Cancelar para a coluna ação
      const btnSalvar = document.createElement('button');
      btnSalvar.textContent = 'Salvar';
      btnSalvar.className = 'save-btn';
      btnSalvar.onclick = salvarObs;
      const btnCancelar = document.createElement('button');
      btnCancelar.textContent = 'Cancelar';
      btnCancelar.className = 'cancel-btn';
      btnCancelar.onclick = cancelarObs;
      // Função auxiliar para restaurar botões padrão
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
      
      // Funções de ação
      function salvarObs() {
        contact.observacao = textarea.value.trim();
        self.saveContactsToStorage();
        obsDiv.innerHTML = self.escapeHtml(contact.observacao || '');
        obsDiv.style.whiteSpace = 'pre-line';
        obsDiv.style.minHeight = '24px';
        obsDiv.style.padding = '4px 0';
        obsDiv.style.cursor = 'pointer';
        // Restaura botões padrão na coluna ação
        restaurarBotoes();
      }
      function cancelarObs() {
        obsDiv.innerHTML = self.escapeHtml(contact.observacao || '');
        obsDiv.style.whiteSpace = 'pre-line';
        obsDiv.style.minHeight = '24px';
        obsDiv.style.padding = '4px 0';
        obsDiv.style.cursor = 'pointer';
        // Restaura botões padrão na coluna ação
        restaurarBotoes();
      }
      // Substitui conteúdo e exibe textarea
      obsDiv.innerHTML = '';
      obsDiv.appendChild(textarea);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      textarea.dispatchEvent(new Event('input'));
      // Troca botões da coluna ação
      const tdAcao = tr.querySelector('.td-acao');
      const self = this;
      tdAcao.innerHTML = '';
      tdAcao.appendChild(btnSalvar);
      tdAcao.appendChild(btnCancelar);
    };
    return tr;
  }

  // Função utilitária para formatar número de telefone no padrão DDD+NÚMERO (ex: 16981892476)
  formatarNumeroTelefone(numero) {
    if (!numero) return '';
    // Remove tudo que não for dígito
    return numero.toString().replace(/\D/g, '');
  }
  // Cria o link de chamada para o contato
  createCallLink(ramal, numero, contatoNome) {
    if (!ramal && !numero) {
      console.warn('[createCallLink] Dados insuficientes para criar link de chamada');
      return '<span class="no-data">Dados insuficientes</span>';
    }
    
    // Formata o número para DDD+NÚMERO (ex: 16981892476)
    const numeroFormatado = this.formatarNumeroTelefone(numero);
    
    // Montar URL com callid (nome do contato) se disponível
    let link = `https://delorean.krolik.com.br/services/call?ramal=${encodeURIComponent(ramal)}&numero=${encodeURIComponent(numeroFormatado)}`;
    if (contatoNome && contatoNome.trim() !== '') {
      link += `&callid=${encodeURIComponent(contatoNome.trim())}`;
    }
    
    return `<button type="button" class="call-button" title="Fazer chamada" data-call-url="${link}">📞 Ligar</button>`;
  }

  // Executa a chamada de forma oculta
  executeCall(url) {
    if (!url) {
      console.error('[executeCall] URL não fornecida!');
      this.showError('Erro: URL da chamada não fornecida.');
      return;
    }
    
    try {
      // Cria um iframe invisível para fazer a requisição
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = url;
      
      // Adiciona o iframe ao DOM
      document.body.appendChild(iframe);
      
      // Adiciona evento de load para verificar se carregou
      iframe.onload = () => {
        this.showSuccess('Chamada iniciada! Consulte o softphone.');
      };
      
      // Adiciona evento de error para capturar erros
      iframe.onerror = (error) => {
        console.error('[executeCall] Erro ao carregar iframe:', error);
        this.showError('Erro ao iniciar chamada. Tente novamente.');
      };
      
      // Mostra feedback imediato para o usuário
      this.showSuccess('Chamada iniciada! Consulte o softphone.');
      
      // Remove o iframe após um tempo para limpar o DOM
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



  // Exibe mensagem de estado vazio na tabela
  showEmptyState(tbody) {
    const tr = document.createElement('tr');
    // Descobre o número de colunas da tabela dinamicamente
    const thCount = this.contactsTable.querySelectorAll('thead th').length;
    tr.innerHTML = `<td colspan="${thCount}" class="empty-state">Nenhum contato encontrado</td>`;
    tbody.appendChild(tr);
  }

  // Anima as linhas da tabela ao exibir
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

  // Escapa HTML para evitar XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Evento de drag enter no input de upload
  handleDragEnter(e) {
    e.preventDefault();
    this.uploadInput.classList.add('drag-over');
  }

  // Evento de drag leave no input de upload
  handleDragLeave(e) {
    e.preventDefault();
    this.uploadInput.classList.remove('drag-over');
  }

  // Evento de drag over no input de upload
  handleDragOver(e) {
    e.preventDefault();
  }

  // Evento de drop no input de upload
  handleDrop(e) {
    e.preventDefault();
    this.uploadInput.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.uploadInput.files = files;
      this.handleFileUpload({ target: { files } });
    }
  }

  // Exibe toast de carregando
  showLoading(message) {
    this.showMessage(message, 'loading');
  }

  // Exibe toast de sucesso
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  // Exibe toast de aviso
  showWarning(message) {
    this.showMessage(message, 'warning');
  }

  // Exibe toast de erro
  showError(message) {
    this.showMessage(message, 'error');
  }

  // Esconde qualquer toast
  hideLoading() {
    this.hideMessage();
  }

  // Exibe toast customizado
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

  // Esconde qualquer toast
  hideMessage() {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
  }

  // Exibe modal de confirmação customizada
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

  // Formata data/hora para exibição legível
  formatarDataHora(calldate) {
    if (!calldate) return 'Data não disponível';
    try {
      // Formato esperado: 2025-10-29 11:29:03 ou 2025-10-29+11%3A29%3A03 (URL-encoded)
      let dataStr = calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
      let data = new Date(dataStr);
      if (isNaN(data.getTime())) {
        // Tentar parse manual se Date falhar
        const partes = dataStr.split(/[\s\-:]/);
        if (partes.length >= 6) {
          const ano = parseInt(partes[0]);
          const mes = parseInt(partes[1]) - 1;
          const dia = parseInt(partes[2]);
          const hora = parseInt(partes[3] || 0);
          const minuto = parseInt(partes[4] || 0);
          const segundo = parseInt(partes[5] || 0);
          const dataManual = new Date(ano, mes, dia, hora, minuto, segundo);
          if (!isNaN(dataManual.getTime())) {
            data = dataManual;
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
      return calldate; // Retorna original se não conseguir formatar
    } catch (e) {
      return calldate;
    }
  }

  // Formata duração em segundos para mm:ss
  formatarDuracao(segundos) {
    if (!segundos || isNaN(segundos)) return '0:00';
    const seg = parseInt(segundos);
    const minutos = Math.floor(seg / 60);
    const segs = seg % 60;
    return `${minutos}:${String(segs).padStart(2, '0')}`;
  }

  // Exibe modal de gravação com áudio e transcrição
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
    
    // Buscar contato atualizado (com gravações)
    // IMPORTANTE: Recarregar do localStorage para garantir dados atualizados
    this.loadContactsFromStorage();
    
    
    // Buscar contato com match mais flexível (ramal pode ser sufixo)
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
    
    // Gerar HTML da lista de gravações
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
      // Ordenar por data (mais recente primeiro)
      const gravacoesOrdenadas = [...gravacoes].sort((a, b) => {
        const dateA = new Date(a.calldate.replace(/\+/g, ' ').replace(/%3A/g, ':'));
        const dateB = new Date(b.calldate.replace(/\+/g, ' ').replace(/%3A/g, ':'));
        return dateB - dateA; // Mais recente primeiro
      });
      
      gravacoesHTML = gravacoesOrdenadas.map((gravacao, index) => {
        const dataFormatada = this.formatarDataHora(gravacao.calldate);
        const duracaoFormatada = this.formatarDuracao(gravacao.billsec);
        
        // Status da ligação: sempre "Atendida" se há gravação
        // Pois não haveria gravação se a ligação não fosse atendida
        const dispositionValue = 'Atendida';
        const dispositionFormatado = this.escapeHtml(dispositionValue);
        
        // Exibir callid se disponível
        const callidDisplay = gravacao.callid ? ` • CallID: ${this.escapeHtml(gravacao.callid)}` : '';
        
        // Verificar e processar URL da gravação (APENAS para exibição)
        let urlGravacao = gravacao.url || '';
        if (!urlGravacao && gravacao.codigo) {
          // Fallback: construir URL se não vier do n8n
          urlGravacao = `https://delorean.krolik.com.br/services/record/${gravacao.codigo}`;
        }
        
        // Converter URL para novo formato APENAS na exibição
        // De: https://delorean.krolik.com.br/services/record/CODIGO
        // Para: https://delorean.krolik.com.br/records/CODIGO.wav
        if (urlGravacao && gravacao.codigo) {
          urlGravacao = `https://delorean.krolik.com.br/records/${gravacao.codigo}.wav`;
        }
        
        
        // Não usar escapeHtml na URL - pode quebrar caracteres especiais
        // Usar encodeURI apenas para componentes da URL se necessário
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
                  <source src="${urlGravacaoFinal}" type="audio/wav">
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
            <div style="
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
            ">
              <div style="color: #999; font-size: 0.9rem; text-align: center; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
                Transcrição será exibida aqui<br>
                <span style="font-size: 0.85rem; color: #777;">(A implementar)</span>
              </div>
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
    
    // Eventos de fechamento
    document.getElementById('close-modal-gravacao').onclick = function() {
      modal.remove();
    };
    document.getElementById('close-modal-x-gravacao').onclick = function() {
      modal.remove();
    };
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };
    
    // Responsividade
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
    
    // Limpa o listener quando o modal for removido
    const originalRemove = modal.remove;
    modal.remove = function() {
      window.removeEventListener('resize', resizeModal);
      originalRemove.call(this);
    };
    
    // Inicializar players de áudio simples após o modal ser criado
    setTimeout(() => {
      const audioPlayers = modal.querySelectorAll('audio');
      
      audioPlayers.forEach((audioElement, index) => {
        try {
          const audioId = audioElement.id;
          const playerIndex = index;
          
          // Carregar metadados
          audioElement.load();
          
          // Event listeners para atualizar UI
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
          
          // Atualizar volume inicial
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

  // Processa dados do webhook e adiciona gravação ao contato
  processWebhookData(body) {
    
    if (!body) {
      console.error('[processWebhookData] ERRO: Body vazio ou undefined!');
      this.showError('Dados do webhook estão vazios.');
      return;
    }
    
    try {
      let calldate, src, dst, duration, billsec, disposition, userfield, price, company_id, accountcode, url, callid;
      
      // Detectar se é objeto JSON (dados processados do n8n) ou string URL-encoded (dados brutos)
      if (typeof body === 'object' && !Array.isArray(body) && body !== null) {
        // Dados processados do n8n (JSON)
        calldate = body.calldate || '';
        src = body.src || '';
        dst = body.dst || '';
        duration = body.duration || '0';
        billsec = body.billsec || '0';
        disposition = body.disposition || '';
        userfield = body.userfield || '';
        price = body.price || '0';
        company_id = body.company_id || '';
        accountcode = body.accountcode || '';
        callid = body.callid || ''; // CallID do contato (nome)
        url = body.url || ''; // URL já processada pelo n8n
        
      } else if (typeof body === 'string') {
        // Dados brutos do Delorean (URL-encoded)
        if (body.trim() === '') {
          console.error('[processWebhookData] ERRO: Body vazio!');
          this.showError('Dados do webhook estão vazios.');
          return;
        }
        
        const params = new URLSearchParams(body);
        
        // Extrair todos os campos
        calldate = params.get('calldate') || '';
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
        
        // Construir URL da gravação manualmente (fallback)
        url = userfield ? `https://delorean.krolik.com.br/services/record/${userfield}` : '';
      } else {
        console.error('[processWebhookData] ERRO: Formato de dados não reconhecido!');
        console.error('[processWebhookData] Tipo recebido:', typeof body);
        this.showError('Formato de dados do webhook não reconhecido.');
        return;
      }
      

      // Validar campos obrigatórios
      if (!src || !dst || !userfield) {
        console.error('[processWebhookData] ERRO: Campos obrigatórios faltando!');
        console.error('  - src presente?', !!src, 'Valor:', src);
        console.error('  - dst presente?', !!dst, 'Valor:', dst);
        console.error('  - userfield presente?', !!userfield, 'Valor:', userfield);
        this.showWarning('Webhook recebido com dados incompletos. Verifique o console.');
        return;
      }
      

      // Formatar telefone para match (remover formatação, apenas números)
      const telefoneFormatado = dst.replace(/\D/g, '');
      const srcString = src ? src.toString() : '';
      
      const contatoIndex = this.contacts.findIndex((c, idx) => {
        const ramalContato = c.ramal ? c.ramal.toString() : '';
        const numeroContato = c.numero ? c.numero.toString().replace(/\D/g, '') : '';
        
        // Match de ramal: pode ser exato OU o ramal do contato pode terminar com o src do webhook
        // (ex: contato tem "1003029", webhook tem "3029")
        const ramalMatchExato = ramalContato === srcString;
        const ramalMatchSufixo = ramalContato.endsWith(srcString) && srcString !== '';
        const ramalMatch = ramalMatchExato || ramalMatchSufixo;
        
        // Match de telefone: compara apenas números
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

      // Usar URL já processada pelo n8n ou construir manualmente se não disponível
      if (!url && userfield) {
        url = `https://delorean.krolik.com.br/services/record/${userfield}`;
      }

      // Status da ligação: sempre "Atendida" se há gravação
      // Pois não haveria gravação se a ligação não fosse atendida
      const dispositionNormalizado = 'Atendida';
      
      // Criar objeto de gravação
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
        company_id: company_id || '',
        accountcode: accountcode || ''
      };
      
      // Adicionar gravação ao contato (no início do array para manter ordem mais recente primeiro)
      if (!this.contacts[contatoIndex].gravacoes) {
        this.contacts[contatoIndex].gravacoes = [];
      }
      
      // Verificar se já existe gravação com o mesmo código (evitar duplicatas)
      const existeGravacao = this.contacts[contatoIndex].gravacoes.some(g => g.codigo === userfield);
      
      if (!existeGravacao) {
        this.contacts[contatoIndex].gravacoes.unshift(gravacao); // Adiciona no início
        
        try {
          this.saveContactsToStorage();
          // Atualizar apenas o ícone de gravação na linha específica (não re-renderizar toda a tabela)
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

  // Recebe requisição de webhook (pode ser chamada via fetch ou manualmente)
  handleWebhookRequest(body) {
    
    if (!body) {
      console.error('[handleWebhookRequest] ERRO: Body vazio ou undefined!');
      this.showError('Webhook recebido sem dados. Body está vazio.');
      return;
    }
    
    // Se body for um objeto Event (de um fetch), extrair o body
    if (typeof body === 'string') {
      this.processWebhookData(body);
    } else if (body && body.formData) {
      // Se for FormData, converter para string URL-encoded
      const formData = body.formData;
      const params = new URLSearchParams();
      for (const [key, value] of formData.entries()) {
        params.append(key, value);
      }
      const formDataString = params.toString();
      this.processWebhookData(formDataString);
    } else if (body && typeof body === 'object' && !Array.isArray(body)) {
      // Objeto JSON - pode ser dados processados do n8n (com url pronta) ou objeto a ser convertido
      if (body.url) {
        // Passar objeto diretamente - processWebhookData já trata objetos JSON
        this.processWebhookData(body);
      } else {
        // Objeto sem URL - converter para URL-encoded (compatibilidade com código antigo)
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

  // Função para testar webhook manualmente (útil para testes)
  testWebhook(testData) {
    // Exemplo de uso:
    // window.clickCallManager.testWebhook('calldate=2025-10-29+11%3A29%3A03&src=1001099&dst=16981317956&duration=15&billsec=12&disposition=ANSWERED&userfield=20251029_112915_1001099_103_16981317956_1761748146&price=0.105&company_id=100&accountcode=5.00');
    if (!testData) {
      // Exemplo padrão para teste
      testData = 'calldate=2025-10-29+11%3A29%3A03&src=1001099&dst=16981317956&duration=15&billsec=12&disposition=ANSWERED&userfield=20251029_112915_1001099_103_16981317956_1761748146&price=0.105&company_id=100&accountcode=5.00';
    }
    this.handleWebhookRequest(testData);
  }

  // Configurar listener para webhook (pode ser chamado via fetch ou evento customizado)
  setupWebhookListener() {
    
    // Expor função global para receber webhooks externos
    window.receberWebhook = (body) => {
      
      if (this && typeof this.handleWebhookRequest === 'function') {
        this.handleWebhookRequest(body);
      } else {
        console.error('[setupWebhookListener] ERRO: ClickCallManager não está inicializado!');
        console.error('[setupWebhookListener] this:', this);
        console.error('[setupWebhookListener] typeof this:', typeof this);
      }
    };
    

    // Listener para eventos customizados (útil para integração)
    window.addEventListener('webhook-received', (event) => {
      
      if (event.detail && event.detail.body) {
        this.handleWebhookRequest(event.detail.body);
      } else {
        console.error('[setupWebhookListener] ERRO: Evento sem body válido!');
        console.error('[setupWebhookListener] event.detail:', event.detail);
      }
    });
    
  }

  // Iniciar polling de webhooks do backend
  startWebhookPolling() {
    // Proteção: se já existe um polling ativo, parar antes de iniciar um novo
    if (this.webhookPollingIntervalId) {
      clearInterval(this.webhookPollingIntervalId);
      this.webhookPollingIntervalId = null;
    }
    
    // URL do backend (ajuste conforme necessário)
    const webhookServerUrl = this.webhookServerUrl || 'http://localhost:4201';
    const pollingInterval = this.webhookPollingInterval || 5000; // 5 segundos por padrão
    
    
    let lastWebhookTimestamp = null;
    
    // Função para buscar webhook
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
        
        // Se tem dados e é um webhook novo (timestamp diferente)
        
        if (result.success && result.data && result.timestamp !== lastWebhookTimestamp) {
          
          lastWebhookTimestamp = result.timestamp;
          
          // Detectar tipo de dados baseado no source
          let dataToProcess = result.data;
          
          if (result.source === 'n8n_processed') {
            // Dados processados do n8n (JSON) - passar como objeto
            
            if (typeof dataToProcess === 'string') {
              try {
                dataToProcess = JSON.parse(dataToProcess);
              } catch (e) {
                console.error('[startWebhookPolling] ❌ ERRO ao fazer parse JSON:', e);
              }
            } else if (typeof dataToProcess === 'object') {
            }
          } else if (result.source === 'delorean_raw') {
            // Dados brutos do Delorean (URL-encoded) - passar como string
            if (typeof dataToProcess === 'object') {
              // Converter objeto para URL-encoded se necessário
              const params = new URLSearchParams();
              Object.keys(dataToProcess).forEach(key => {
                params.append(key, dataToProcess[key]);
              });
              dataToProcess = params.toString();
            }
          }
          
          // Log do dado final a ser processado
          if (typeof dataToProcess === 'object') {
          }
          
          // Processar webhook recebido
          if (typeof this.handleWebhookRequest === 'function') {
            this.handleWebhookRequest(dataToProcess);
          } else {
            console.error('[startWebhookPolling] ❌ ERRO: handleWebhookRequest não está disponível!');
          }
        } else if (!result.success) {
          // Log apenas se não for "nenhum webhook ainda"
          if (result.message !== 'Nenhum webhook recebido ainda') {
          }
        }
      } catch (error) {
        // Não logar erro de conexão a cada tentativa (muito spam)
        // Só logar uma vez a cada 10 tentativas ou se for primeiro erro
        if (!this._webhookConnectionErrorLogged) {
          console.warn('[startWebhookPolling] ⚠️  Servidor de webhook não acessível. Verifique se o backend está rodando.');
          console.warn('[startWebhookPolling] URL tentada:', webhookServerUrl);
          console.warn('[startWebhookPolling] Erro:', error.message);
          this._webhookConnectionErrorLogged = true;
        }
      }
    };
    
    // Buscar imediatamente na inicialização
    fetchWebhook();
    
    // Configurar intervalo de polling
    this.webhookPollingIntervalId = setInterval(fetchWebhook, pollingInterval);
    
  }

  // Parar polling de webhooks (útil para cleanup)
  stopWebhookPolling() {
    if (this.webhookPollingIntervalId) {
      clearInterval(this.webhookPollingIntervalId);
      this.webhookPollingIntervalId = null;
    }
  }

  // Manipula o upload de arquivo
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
      // Só verifica duplicidade se já houver contatos salvos
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

  // Valida o tipo do arquivo importado
  isValidFileType(file) {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    return validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.csv');
  }

  // Processa o arquivo Excel/CSV importado
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

  // Normaliza os dados dos contatos importados
  normalizeContacts(contacts) {
    // Mapeia os campos para o formato interno usado pelo sistema
    return contacts.map((contact, index) => {
      // Função auxiliar para buscar valor em múltiplas chaves possíveis
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
        
        // Só formata se tiver 11 dígitos e for um CPF válido
        if (cpfOriginal.replace(/\D/g, '').length === 11 && validarCpfCnpj(cpfOriginal)) {
          if (cpfOriginal !== cpfFormatado) {
          }
        } else {
          // Se não é um CPF válido, mantém como está mas adiciona log
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

      // Verifica se "JÁ LIGUEI" está marcado
      const jaLiguei = getValue(['JÁ LIGUEI', 'já liguei', 'JÁ LIGUEI', 'done', 'Done', 'DONE']);
      if (jaLiguei) {
        normalized.done = jaLiguei.toString().toLowerCase() === 'sim' || 
                         jaLiguei.toString().toLowerCase() === 'true' || 
                         jaLiguei.toString().toLowerCase() === '1' ||
                         jaLiguei === true;
      }

      return normalized;
    }).filter(contact => {
      // Deve ter pelo menos um dos campos: contato, ramal ou numero
      const temContato = contact.contato && contact.contato.toString().trim() !== '';
      const temRamal = contact.ramal && contact.ramal.toString().trim() !== '';
      const temNumero = contact.numero && contact.numero.toString().trim() !== '';
      
      const valido = temContato || temRamal || temNumero;
      if (!valido) {
      }
      return valido;
    });
  }

  // Exibe os contatos na tabela
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

  // Atualiza apenas o ícone de gravação na linha específica do contato
  // Evita re-renderizar toda a tabela, mantendo o estado da página
  updateRecordingIcon(contatoIndex) {
    const tbody = this.contactsTable.querySelector('tbody');
    if (!tbody) return;
    
    const contact = this.contacts[contatoIndex];
    if (!contact) return;
    
    // Calcular em qual página o contato está
    const total = this.contacts.length;
    const contactsPerPage = this.contactsPerPage;
    
    // Encontrar a página e índice dentro da página
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
    
    // Se o contato não está na página atual, não precisa atualizar nada
    if (pageNum !== this.currentPage) {
      return;
    }
    
    // Encontrar a linha na tabela (linhas são criadas na ordem de exibição)
    const rows = tbody.querySelectorAll('tr');
    if (pageIndex >= 0 && pageIndex < rows.length) {
      const row = rows[pageIndex];
      const gravarCell = row.querySelector('.td-gravacao');
      
      if (gravarCell) {
        // Verificar se o contato tem gravações (mesma lógica de createContactRow)
        const temContato = contact.contato && contact.contato.trim() !== '';
        const hasRecordings = contact.gravacoes && contact.gravacoes.length > 0;
        
        if (temContato && hasRecordings) {
          // Se já tem o botão de gravação, não precisa fazer nada
          if (!gravarCell.querySelector('.gravar-btn')) {
            // Criar botão de gravação
            const btn = document.createElement('button');
            btn.className = 'gravar-btn';
            btn.title = 'Ver gravações';
            btn.innerHTML = '🎧';
            btn.onclick = () => this.showRecordingModal(contact);
            gravarCell.innerHTML = '';
            gravarCell.appendChild(btn);
          }
        } else {
          // Se não tem gravações ou não tem nome, mostrar apenas traço
          if (gravarCell.querySelector('.gravar-btn')) {
            gravarCell.innerHTML = '<span style="color: #ccc; font-size: 0.9rem;">—</span>';
          }
        }
      }
    }
  }

  // Manipula a exclusão de um contato
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

  // Exibe opções de importação ao importar contatos
  showImportOptions(importedContacts) {
    if (!this.contacts || this.contacts.length === 0) {
      // Não há contatos salvos, importa direto
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

  // Mescla contatos importados sem duplicar ramais
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

  // Substitui todos os contatos pelos importados
  replaceContacts(importedContacts) {
    
    this.contacts = importedContacts;
    this.saveContactsToStorage();
    this.currentPage = 1;
    this.applySortAndDisplay();
    this.showSuccess(`${importedContacts.length} contatos substituídos com sucesso!`);
  }

  // Edição de contato
  handleEditContact(tr, contact, index) {
    if (tr.classList.contains('edit-mode')) return;
    tr.classList.add('edit-mode');
    // Salva valores atuais
    const CONTATO = contact.contato || '';
    const CPF = contact.cpf || '';
    const RAMAL = contact.ramal || '';
    const TELEFONE = contact.numero || '';
    // Substitui células por inputs
    tr.querySelector('.td-contato').innerHTML = `<input type='text' value='${this.escapeHtml(CONTATO)}' style='width:100%'>`;
    tr.querySelector('.td-cpf').innerHTML = `<input type='text' value='${this.escapeHtml(CPF)}' maxlength='18' style='width:100%'>`;
    tr.querySelector('.td-ramal').innerHTML = `<input type='text' value='${this.escapeHtml(RAMAL)}' style='width:100%'>`;
    tr.querySelector('.td-numero').innerHTML = `<input type='text' value='${this.escapeHtml(TELEFONE)}' style='width:100%'>`;
    // Observação já é editável inline
    // Substitui toda a coluna Ação por Salvar/Cancelar
    const tdAcao = tr.querySelector('.td-acao');
    tdAcao.innerHTML = '';
    const btnSalvar = this.createButton('Salvar', 'save-btn');
    const btnCancelar = this.createButton('Cancelar', 'cancel-btn');
    tdAcao.appendChild(btnSalvar);
    tdAcao.appendChild(btnCancelar);
    // Máscara dinâmica para CPF
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

// Função utilitária para formatar CPF ou CNPJ automaticamente
function formatarCpfCnpj(valor) {
  if (!valor) return '';
  valor = valor.toString().replace(/\D/g, '');
  if (valor.length <= 11) {
    // CPF
    if (valor.length === 11) {
      return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return valor;
  } else {
    // CNPJ
    valor = valor.substring(0, 14); // Limita a 14 dígitos
    return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
}
// Função utilitária para validar CPF
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

// Função utilitária para validar CNPJ
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
// Função para validar CPF ou CNPJ automaticamente (apenas quantidade de dígitos)
function validarCpfCnpj(valor) {
  valor = valor.replace(/\D/g, '');
  if (valor.length === 11) return true; // Aceita qualquer CPF com 11 dígitos
  if (valor.length === 14) return true; // Aceita qualquer CNPJ com 14 dígitos
  return false;
}
// Função utilitária para formatar número para visualização: (16) 98189-2476
function formatarNumeroVisual(numero) {
  if (!numero) return '';
  const num = numero.toString().replace(/\D/g, '');
  if (num.length === 11) {
    // Celular com DDD
    return `(${num.substr(0,2)}) ${num.substr(2,5)}-${num.substr(7,4)}`;
  } else if (num.length === 10) {
    // Fixo com DDD
    return `(${num.substr(0,2)}) ${num.substr(2,4)}-${num.substr(6,4)}`;
  } else if (num.length === 9) {
    // Celular sem DDD
    return `${num.substr(0,5)}-${num.substr(5,4)}`;
  } else if (num.length === 8) {
    // Fixo sem DDD
    return `${num.substr(0,4)}-${num.substr(4,4)}`;
  }
  return numero; // Retorna como está se não bater nenhum padrão
}

// Funções globais para o player de áudio simples

// Formatar tempo (segundos) para formato MM:SS
function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Toggle play/pause
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

// Atualizar barra de progresso
function updateProgress(index) {
  const audio = document.getElementById(`audio-player-${index}`);
  if (!audio) return;
  
  const currentTime = audio.currentTime || 0;
  const duration = audio.duration || 0;
  
  // Atualizar barra
  const progressBar = document.getElementById(`progress-bar-${index}`);
  if (progressBar && duration > 0) {
    const percent = (currentTime / duration) * 100;
    progressBar.style.width = percent + '%';
  }
  
  // Atualizar tempo atual
  const currentTimeEl = document.getElementById(`current-time-${index}`);
  if (currentTimeEl) {
    currentTimeEl.textContent = formatTime(currentTime);
  }
}

// Seek (pular para posição específica)
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

// Ajustar volume
function setVolume(index, value) {
  const audio = document.getElementById(`audio-player-${index}`);
  if (!audio) return;
  
  const volume = parseFloat(value);
  audio.volume = volume;
  
  // Atualizar texto de volume
  const volumeText = document.getElementById(`volume-text-${index}`);
  if (volumeText) {
    volumeText.textContent = Math.round(volume * 100) + '%';
  }
}

// Ajustar velocidade
function setSpeed(index, value) {
  const audio = document.getElementById(`audio-player-${index}`);
  if (!audio) return;
  
  const speed = parseFloat(value);
  audio.playbackRate = speed;
}

// Função global para download de áudio
async function downloadAudio(url, filename) {
  try {
    
    // Mostrar notificação de carregamento
    if (window.clickCallManager && window.clickCallManager.showWarning) {
      window.clickCallManager.showWarning('Preparando download...');
    }
    
    // Buscar o arquivo usando fetch
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar arquivo: ${response.status} ${response.statusText}`);
    }
    
    // Converter resposta para Blob
    const blob = await response.blob();
    
    // Criar URL temporária do Blob
    const blobUrl = window.URL.createObjectURL(blob);
    
    // Criar link temporário para download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    
    // Adicionar ao DOM temporariamente
    document.body.appendChild(link);
    
    // Disparar clique para iniciar download
    link.click();
    
    // Limpar: remover link e revogar URL do Blob
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
    
    // Notificar o usuário
    if (window.clickCallManager && window.clickCallManager.showSuccess) {
      window.clickCallManager.showSuccess(`Download iniciado: ${filename}`);
    }
    
  } catch (error) {
    console.error('[downloadAudio] ❌ Erro ao fazer download:', error);
    
    // Tentar fallback: download direto (pode não funcionar por CORS)
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
      
      // Último recurso: abrir em nova aba
      window.open(url, '_blank');
      
      if (window.clickCallManager && window.clickCallManager.showWarning) {
        window.clickCallManager.showWarning('Não foi possível iniciar o download automaticamente. Abrindo em nova aba... (Você pode fazer o download manualmente clicando com botão direito → Salvar como)');
      }
    }
  }
}

function initializeClickCall() {
  // Proteção: se já existe uma instância, parar polling anterior antes de criar nova
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