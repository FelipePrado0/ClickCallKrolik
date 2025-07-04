/**
 * TODO - Funcionalidades do ClickCall
 *
 * ✔ 1. Persistência dos contatos e checkbox "Já liguei" no localStorage.
 *    Todos os contatos e o status do checkbox são salvos automaticamente.
 *    Ao abrir o sistema, os dados são carregados do localStorage.
 *    O usuário nunca perde seus dados, mesmo fechando o navegador.
 *    Chave de armazenamento: 'clickcall_contatos'.
 *
 * ✔ 2. Exportar contatos (Excel/CSV).
 *    Botão exporta todos os contatos para Excel (.xlsx) ou CSV (.csv).
 *    Usa a biblioteca XLSX para gerar arquivos compatíveis.
 *    Exporta as colunas: Contato, Ramal, Telefone, Já liguei.
 *
 * ✔ 3. Busca e filtro.
 *    Campo de busca acima da tabela filtra em tempo real.
 *    Busca por nome, ramal ou telefone, sem diferenciar maiúsculas/minúsculas.
 *    Funciona junto com ordenação, paginação e exportação.
 *    Resultados filtrados atualizam a paginação automaticamente.
 *
 * ✔ 4. Ordenação.
 *    Clique no cabeçalho de cada coluna ordena crescente/decrescente.
 *    Ordenação visual e intuitiva, com integração total ao filtro e paginação.
 *    Estado da ordenação é mantido durante a navegação.
 *    Permite encontrar rapidamente qualquer contato.
 *
 * ✔ 5. Confirmação ao excluir.
 *    Modal customizada em português confirma antes de remover contato.
 *    O contato só é removido se o usuário clicar em "Sim".
 *    Evita exclusões acidentais e aumenta a segurança dos dados.
 *
 * ✔ 6. Feedback visual aprimorado.
 *    Toasts modernos para mensagens de sucesso, erro e aviso.
 *    Modal customizada para confirmação de exclusão.
 *    Todas as notificações são em português e integradas ao layout.
 *    Não há mais alertas nativos do navegador.
 *
 * ✔ 8. Validação de telefone/ramal.
 *    Ramal: só números, mínimo 7 dígitos. Telefone: só números, mínimo 8.
 *    Validação feita ao adicionar contato, com mensagem de erro clara.
 *    Garante integridade dos dados e evita erros de digitação.
 *
 * ✔ 10. Importação inteligente (mesclar/substituir).
 *    Modal pergunta se o usuário deseja mesclar (sem duplicar ramais) ou substituir
 *    Mesclar: adiciona apenas ramais novos. Substituir: apaga todos e importa só os novos.
 *    Cancelar fecha a modal sem alterar os dados.
 *    Importação rápida e segura.
 *
 * ✔ 13. Paginação.
 *    Usuário escolhe 10, 25 ou 50 contatos por página.
 *    Controles de navegação "Anterior" e "Próxima" abaixo da tabela.
 *    Paginação integrada com busca, filtro, ordenação, adição e remoção.
 *    Experiência fluida mesmo com muitos contatos.
 *
 */

/**
 * ClickCall - Gerenciador de Contatos
 * Classe principal para gerenciar upload e exibição de contatos
 */
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
      this.isInitialized = true;
      this.displayContacts(this.contacts);
      console.log('ClickCall Manager inicializado com sucesso');
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
    if (!this.contacts.length) {
      this.showWarning('Não há contatos para exportar.');
      return;
    }
    const data = this.contacts.map(c => ({
      'NOME': c.NOME || c.CONTATO || c.contato || '',
      'CPF': c.CPF || c.cpf || '',
      'RAMAL': c.RAMAL || c.ramal || '',
      'TELEFONE': c.TELEFONE || c.numero || '',
      'JÁ LIGUEI': c["JÁ LIGUEI"] ? 'Sim' : 'Não',
      'AÇÃO': '', // Campo visual, exporta vazio
      'OBSERVAÇÃO': c.OBSERVAÇÃO || c.observacao || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
    const format = this.exportSelect.value;
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
      } catch (e) {
        this.contacts = [];
      }
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
      <td><input type="text" placeholder="NOME" required></td>
      <td><input type="text" placeholder="CPF" maxlength="14"></td>
      <td><input type="text" placeholder="RAMAL" required></td>
      <td><input type="text" placeholder="TELEFONE" required></td>
      <td style="text-align:center;"><input type="checkbox" class="checkbox-done" title="JÁ LIGUEI"></td>
      <td class="td-acao"></td>
      <td><textarea placeholder="OBSERVAÇÃO" rows="1" style="resize:none;overflow:hidden;width:100%"></textarea></td>
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
      this.value = formatarCPF(this.value);
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
      if (CPF && !validarCPF(CPF)) {
        this.showError('CPF inválido.');
        return;
      }
      this.contacts.unshift({ contato: CONTATO, cpf: CPF, ramal: RAMAL, numero: TELEFONE, done: JALIGUEI, observacao: OBSERVAÇÃO });
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
    // Ordem: CONTATO, CPF, RAMAL, TELEFONE, JÁ LIGUEI, AÇÃO, OBSERVAÇÃO
    const callLink = this.createCallLink(contact.ramal, contact.numero);
    tr.innerHTML = `
      <td class="td-contato">${this.escapeHtml(contact.contato)}</td>
      <td class="td-cpf">${this.escapeHtml(contact.cpf || '')}</td>
      <td class="td-ramal">${this.escapeHtml(contact.ramal)}</td>
      <td class="td-numero">${this.escapeHtml(contact.numero)}</td>
      <td style="text-align:center;" class="td-done"><input type="checkbox" ${contact.done ? 'checked' : ''} data-index="${index}" class="checkbox-done" title="Já liguei"></td>
      <td class="td-acao">${callLink}<button class="edit-btn" title="Editar">Editar</button><button class="delete-btn" title="Remover">Remover</button></td>
      <td class="td-observacao"><div class="obs-view" style="white-space:pre-line;min-height:24px;padding:4px 0;cursor:pointer;">${this.escapeHtml(contact.observacao || '')}</div></td>
    `;
    const checkbox = tr.querySelector('.checkbox-done');
    checkbox.addEventListener('change', () => {
      this.contacts[index].done = checkbox.checked;
      this.saveContactsToStorage();
    });
    const btnDelete = tr.querySelector('.delete-btn');
    btnDelete.onclick = () => this.handleDeleteContact(index);
    const btnEdit = tr.querySelector('.edit-btn');
    btnEdit.onclick = () => this.handleEditContact(tr, contact, index);
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
      textarea.addEventListener('blur', () => {
        contact.observacao = textarea.value.trim();
        this.saveContactsToStorage();
        obsDiv.innerHTML = this.escapeHtml(contact.observacao || '');
        obsDiv.style.whiteSpace = 'pre-line';
        obsDiv.style.minHeight = '24px';
        obsDiv.style.padding = '4px 0';
        obsDiv.style.cursor = 'pointer';
      });
      obsDiv.innerHTML = '';
      obsDiv.appendChild(textarea);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      textarea.dispatchEvent(new Event('input'));
    };
    return tr;
  }

  // Cria o link de chamada para o contato
  createCallLink(ramal, numero) {
    if (!ramal && !numero) {
      return '<span class="no-data">Dados insuficientes</span>';
    }
    const link = `https://bugatti.krolik.com.br/services/call?ramal=${encodeURIComponent(ramal)}&numero=${encodeURIComponent(numero)}`;
    return `<a href="${link}" target="_blank" class="call-button" title="Fazer chamada">📞 Ligar</a>`;
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

  // Exibe erros de validação em um modal
  showValidationErrors(erros) {
    const oldModal = document.getElementById('custom-modal-validation');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'custom-modal-validation';
    modal.className = 'modal-confirm-bg';
    
    const errosHtml = erros.map(erro => `<div class="erro-linha">• ${erro}</div>`).join('');
    
    modal.innerHTML = `
      <div class="modal-confirm" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
        <div class="modal-confirm-msg">
          <h3 style="color: #e74c3c; margin-bottom: 15px;">⚠️ Erros de Validação Encontrados</h3>
          <p style="margin-bottom: 15px;">A planilha contém os seguintes erros que precisam ser corrigidos:</p>
          <div class="erros-lista" style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #e74c3c;">
            ${errosHtml}
          </div>
          <p style="margin-top: 15px; font-size: 14px; color: #666;">
            <strong>Campos obrigatórios:</strong> NOME/CONTATO, RAMAL (mínimo 7 dígitos), TELEFONE/NUMERO (mínimo 8 dígitos)<br>
            <strong>CPF:</strong> Se fornecido, deve ter 11 dígitos e ser válido
          </p>
        </div>
        <div class="modal-confirm-actions">
          <button class="modal-btn-cancel">Entendi</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-btn-cancel').onclick = () => {
      modal.remove();
    };
  }

  // Exibe modal para solicitar código da empresa
  showEmpresaCodeModal(contatosValidos, ramais4Digitos) {
    const oldModal = document.getElementById('custom-modal-empresa');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'custom-modal-empresa';
    modal.className = 'modal-confirm-bg';
    
    const ramaisHtml = ramais4Digitos.map(item => 
      `<div class="ramal-item">• Linha ${item.linha}: ${item.contato} (Ramal: ${item.ramal})</div>`
    ).join('');
    
    modal.innerHTML = `
      <div class="modal-confirm" style="max-width: 500px;">
        <div class="modal-confirm-msg">
          <h3 style="color: #3498db; margin-bottom: 15px;">🏢 Código da Empresa Necessário</h3>
          <p style="margin-bottom: 15px;">Foram encontrados ${ramais4Digitos.length} contato(s) com ramal de 4 dígitos que precisam do código da empresa:</p>
          <div class="ramais-lista" style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #3498db; max-height: 200px; overflow-y: auto; margin-bottom: 15px;">
            ${ramaisHtml}
          </div>
          <p style="margin-bottom: 15px;">Digite o código da empresa (3 dígitos) que será adicionado antes dos ramais de 4 dígitos:</p>
          <input type="text" id="codigo-empresa" placeholder="Ex: 123" maxlength="3" style="width: 50%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 20px; text-align: center; letter-spacing: 2px;" pattern="[0-9]{3}">
          <p style="margin-top: 10px; font-size: 14px; color: #666;">
            <strong>Exemplo:</strong> Se o código for "123" e o ramal for "1000", ficará "1231000"
          </p>
        </div>
        <div class="modal-confirm-actions">
          <button class="modal-btn-confirm" id="btn-confirmar-codigo">Confirmar</button>
          <button class="modal-btn-cancel">Cancelar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const inputCodigo = modal.querySelector('#codigo-empresa');
    const btnConfirmar = modal.querySelector('#btn-confirmar-codigo');
    const btnCancelar = modal.querySelector('.modal-btn-cancel');
    
    // Foca no input automaticamente
    inputCodigo.focus();
    
    // Validação do input (apenas números)
    inputCodigo.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').slice(0, 3);
    });
    
    // Confirma o código
    btnConfirmar.onclick = () => {
      const codigo = inputCodigo.value.trim();
      if (codigo.length !== 3) {
        this.showError('O código da empresa deve ter exatamente 3 dígitos.');
        return;
      }
      // Processa os contatos com o código da empresa
      const contatosProcessados = this.processarContatosComCodigo(contatosValidos, ramais4Digitos, codigo);
      modal.remove();
      // Se não houver contatos processados, mostra erro
      if (!contatosProcessados || contatosProcessados.length === 0) {
        this.showError('Nenhum contato válido após processar os ramais.');
        return;
      }
      // Continua o fluxo normal de importação
      this.showImportOptions(contatosProcessados);
    };
    
    // Cancela
    btnCancelar.onclick = () => {
      modal.remove();
    };
    
    // Enter para confirmar
    inputCodigo.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        btnConfirmar.click();
      }
    });
  }

  // Processa os contatos adicionando o código da empresa aos ramais de 4 dígitos
  processarContatosComCodigo(contatosValidos, ramais4Digitos, codigoEmpresa) {
    console.log(`Processando contatos com código da empresa: ${codigoEmpresa}`);
    
    // Cria um mapa dos ramais de 4 dígitos para facilitar a busca
    const mapaRamais4Digitos = new Map();
    ramais4Digitos.forEach(item => {
      mapaRamais4Digitos.set(item.linha, item.ramal);
    });
    
    // Processa os dados originais novamente para incluir os ramais de 4 dígitos
    const dadosOriginais = this.lastProcessedData;
    const contatosProcessados = [];
    
    dadosOriginais.forEach((contact, index) => {
      const linha = index + 2;
      
      // Função auxiliar para buscar valor em múltiplas chaves possíveis
      const getValue = (keys) => {
        for (let key of keys) {
          if (contact[key] !== undefined && contact[key] !== null && contact[key] !== '') {
            return contact[key];
          }
        }
        return '';
      };

      const contato = getValue(['CONTATO', 'contato', 'Contato', 'NOME', 'Nome', 'nome']);
      const ramal = getValue(['RAMAL', 'ramal', 'Ramal']);
      const numero = getValue(['TELEFONE', 'telefone', 'Telefone', 'NUMERO', 'numero', 'Numero', 'FONE', 'fone', 'Fone']);
      
      if (!contato || !ramal || !numero) return;
      
      const ramalNumeros = ramal.toString().replace(/\D/g, '');
      const numeroNumeros = numero.toString().replace(/\D/g, '');
      
      // Verifica se é um ramal de 4 dígitos
      let ramalFinal = ramalNumeros;
      if (ramalNumeros.length === 4) {
        ramalFinal = codigoEmpresa + ramalNumeros;
        console.log(`Ramal processado: ${ramalNumeros} → ${ramalFinal} (${contato})`);
      }
      
      // Processamento do CPF
      const cpfOriginal = getValue(['CPF', 'cpf']);
      let cpfFormatado = '';
      const cpfStr = (cpfOriginal !== undefined && cpfOriginal !== null) ? String(cpfOriginal) : '';
      if (cpfStr) {
        cpfFormatado = formatarCPF(cpfStr);
        if (cpfStr.replace(/\D/g, '').length > 0) {
          if (cpfStr.replace(/\D/g, '').length !== 11) {
            console.log(`CPF inválido ignorado: ${cpfStr} (${contato})`);
          } else if (!validarCPF(cpfStr)) {
            console.log(`CPF inválido ignorado: ${cpfStr} (${contato})`);
          } else if (cpfStr !== cpfFormatado) {
            console.log(`CPF formatado: ${cpfStr} → ${cpfFormatado} (${contato})`);
          }
        }
      }
      
      const normalized = {
        contato: contato.toString().trim(),
        cpf: cpfFormatado,
        ramal: ramalFinal,
        numero: numeroNumeros,
        done: false,
        observacao: getValue(['OBSERVAÇÃO', 'observacao', 'Observação', 'OBSERVACAO', 'OBS', 'obs', 'Obs'])
      };

      // Verifica se "JÁ LIGUEI" está marcado
      const jaLiguei = getValue(['JÁ LIGUEI', 'já liguei', 'JÁ LIGUEI', 'done', 'Done', 'DONE']);
      if (jaLiguei) {
        normalized.done = jaLiguei.toString().toLowerCase() === 'sim' || 
                         jaLiguei.toString().toLowerCase() === 'true' || 
                         jaLiguei.toString().toLowerCase() === '1' ||
                         jaLiguei === true;
      }

      contatosProcessados.push(normalized);
    });
    
    console.log(`Total de contatos processados: ${contatosProcessados.length}`);
    return contatosProcessados;
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
      console.log('Iniciando processamento do arquivo:', file.name);
      const resultado = await this.processFile(file);
      this.hideLoading();
      
      // Verifica se o resultado contém ramais de 4 dígitos
      if (resultado.ramais4Digitos && resultado.ramais4Digitos.length > 0) {
        this.showEmpresaCodeModal(resultado.contatos, resultado.ramais4Digitos);
        return;
      }
      
      // Processamento normal
      const contacts = resultado;
      console.log('Contatos processados com sucesso:', contacts.length);
      if (contacts.length === 0) {
        this.showWarning('Nenhum contato válido encontrado no arquivo. Verifique se há colunas com NOME/CONTATO, RAMAL ou TELEFONE/NUMERO.');
        return;
      }
      this.showImportOptions(contacts);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      this.hideLoading();
      
      // Se é um erro de validação, mostra os erros específicos
      if (error.message === 'Erros de validação encontrados') {
        // Recupera os erros da função normalizeContacts
        const resultado = this.normalizeContacts(this.lastProcessedData || []);
        if (resultado.erros && resultado.erros.length > 0) {
          this.showValidationErrors(resultado.erros);
        } else {
          this.showError('Erro ao processar o arquivo. Verifique se é um arquivo válido.');
        }
      } else {
        this.showError(`Erro ao processar o arquivo: ${error.message}`);
      }
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
          console.log('Dados brutos do arquivo:', json);
          if (!json || json.length === 0) {
            reject(new Error('Arquivo vazio ou sem dados válidos'));
            return;
          }
          this.lastProcessedData = json; // Armazena para recuperar erros
          const resultado = this.normalizeContacts(json);
          console.log('Resultado da normalização:', resultado);
          
          if (resultado.erros && resultado.erros.length > 0) {
            reject(new Error('Erros de validação encontrados'));
          } else if (resultado.ramais4Digitos && resultado.ramais4Digitos.length > 0) {
            // Há ramais de 4 dígitos, precisa solicitar código da empresa
            resolve({ contatos: resultado.contatos, ramais4Digitos: resultado.ramais4Digitos });
          } else {
            resolve(resultado.contatos);
          }
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
    const erros = [];
    const contatosValidos = [];
    const ramais4Digitos = [];
    
    // Mapeia os campos para o formato interno usado pelo sistema
    contacts.forEach((contact, index) => {
      const linha = index + 2; // +2 porque index começa em 0 e a primeira linha é o cabeçalho
      
      // Função auxiliar para buscar valor em múltiplas chaves possíveis
      const getValue = (keys) => {
        for (let key of keys) {
          if (contact[key] !== undefined && contact[key] !== null && contact[key] !== '') {
            return contact[key];
          }
        }
        return '';
      };

      // Validação dos campos obrigatórios
      const contato = getValue(['CONTATO', 'contato', 'Contato', 'NOME', 'Nome', 'nome']);
      const ramal = getValue(['RAMAL', 'ramal', 'Ramal']);
      const numero = getValue(['TELEFONE', 'telefone', 'Telefone', 'NUMERO', 'numero', 'Numero', 'FONE', 'fone', 'Fone']);
      
      // Verifica se todos os campos obrigatórios estão preenchidos
      if (!contato || contato.toString().trim() === '') {
        erros.push(`Linha ${linha}: Campo NOME/CONTATO está vazio ou não encontrado`);
        return;
      }
      
      if (!ramal || ramal.toString().trim() === '') {
        erros.push(`Linha ${linha}: Campo RAMAL está vazio ou não encontrado`);
        return;
      }
      
      if (!numero || numero.toString().trim() === '') {
        erros.push(`Linha ${linha}: Campo TELEFONE/NUMERO está vazio ou não encontrado`);
        return;
      }
      
      // Validação do formato do ramal
      const ramalNumeros = ramal.toString().replace(/\D/g, '');
      
      // Verifica se é um ramal de 4 dígitos
      if (ramalNumeros.length === 4) {
        ramais4Digitos.push({
          linha: linha,
          contato: contato,
          ramal: ramalNumeros
        });
        return; // Não adiciona à lista de válidos ainda, aguarda o código da empresa
      }
      
      // Validação para ramais que não são de 4 dígitos
      if (ramalNumeros.length < 7) {
        erros.push(`Linha ${linha}: RAMAL deve ter pelo menos 7 dígitos (atual: ${ramalNumeros.length})`);
        return;
      }
      
      // Validação do formato do telefone (apenas números, mínimo 8 dígitos)
      const numeroNumeros = numero.toString().replace(/\D/g, '');
      if (numeroNumeros.length < 8) {
        erros.push(`Linha ${linha}: TELEFONE deve ter pelo menos 8 dígitos (atual: ${numeroNumeros.length})`);
        return;
      }

      // Processamento do CPF
      const cpfOriginal = getValue(['CPF', 'cpf']);
      let cpfFormatado = '';
      
      if (cpfOriginal) {
        cpfFormatado = formatarCPF(cpfOriginal);
        
        // Validação do CPF se fornecido
        if (cpfOriginal.replace(/\D/g, '').length > 0) {
          if (cpfOriginal.replace(/\D/g, '').length !== 11) {
            erros.push(`Linha ${linha}: CPF deve ter 11 dígitos (atual: ${cpfOriginal.replace(/\D/g, '').length})`);
            return;
          }
          
          if (!validarCPF(cpfOriginal)) {
            erros.push(`Linha ${linha}: CPF inválido (${cpfOriginal})`);
            return;
          }
          
          if (cpfOriginal !== cpfFormatado) {
            console.log(`CPF formatado para ${contato}: ${cpfOriginal} → ${cpfFormatado}`);
          }
        }
      }
      
      const normalized = {
        contato: contato.toString().trim(),
        cpf: cpfFormatado,
        ramal: ramalNumeros, // Salva apenas os números
        numero: numeroNumeros, // Salva apenas os números
        done: false,
        observacao: getValue(['OBSERVAÇÃO', 'observacao', 'Observação', 'OBSERVACAO', 'OBS', 'obs', 'Obs'])
      };

      // Verifica se "JÁ LIGUEI" está marcado
      const jaLiguei = getValue(['JÁ LIGUEI', 'já liguei', 'JÁ LIGUEI', 'done', 'Done', 'DONE']);
      if (jaLiguei) {
        normalized.done = jaLiguei.toString().toLowerCase() === 'sim' || 
                         jaLiguei.toString().toLowerCase() === 'true' || 
                         jaLiguei.toString().toLowerCase() === '1' ||
                         jaLiguei === true;
      }

      contatosValidos.push(normalized);
    });
    
    // Se há erros, retorna null e os erros
    if (erros.length > 0) {
      return { contatos: null, erros: erros, ramais4Digitos: [] };
    }
    
    // Se há ramais de 4 dígitos, retorna para solicitar código da empresa
    if (ramais4Digitos.length > 0) {
      return { contatos: contatosValidos, erros: [], ramais4Digitos: ramais4Digitos };
    }
    
    return { contatos: contatosValidos, erros: [], ramais4Digitos: [] };
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
    // Verificação: se a lista importada for idêntica à atual, mostrar aviso e não prosseguir
    if (this.isListaIgual(importedContacts, this.contacts)) {
      this.showModalListaIgual();
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

  // Compara se duas listas de contatos são idênticas
  isListaIgual(listaA, listaB) {
    if (!Array.isArray(listaA) || !Array.isArray(listaB)) return false;
    if (listaA.length !== listaB.length) return false;
    // Ordena para garantir comparação independente da ordem
    const sortFn = (a, b) => {
      if (a.contato !== b.contato) return a.contato.localeCompare(b.contato);
      if (a.ramal !== b.ramal) return a.ramal.localeCompare(b.ramal);
      if (a.numero !== b.numero) return a.numero.localeCompare(b.numero);
      if ((a.cpf || '') !== (b.cpf || '')) return (a.cpf || '').localeCompare(b.cpf || '');
      if ((a.observacao || '') !== (b.observacao || '')) return (a.observacao || '').localeCompare(b.observacao || '');
      if ((a.done ? 1 : 0) !== (b.done ? 1 : 0)) return (a.done ? 1 : 0) - (b.done ? 1 : 0);
      return 0;
    };
    const arrA = [...listaA].sort(sortFn);
    const arrB = [...listaB].sort(sortFn);
    for (let i = 0; i < arrA.length; i++) {
      const a = arrA[i], b = arrB[i];
      if (
        a.contato !== b.contato ||
        a.ramal !== b.ramal ||
        a.numero !== b.numero ||
        (a.cpf || '') !== (b.cpf || '') ||
        (a.observacao || '') !== (b.observacao || '') ||
        (a.done ? 1 : 0) !== (b.done ? 1 : 0)
      ) {
        return false;
      }
    }
    return true;
  }

  // Mostra modal de lista igual
  showModalListaIgual() {
    const oldModal = document.getElementById('custom-modal-lista-igual');
    if (oldModal) oldModal.remove();
    const modal = document.createElement('div');
    modal.id = 'custom-modal-lista-igual';
    modal.className = 'modal-confirm-bg';
    modal.innerHTML = `
      <div class="modal-confirm" style="max-width: 400px;">
        <div class="modal-confirm-msg" style="text-align:center;">
          <h3 style="color: #3498db; margin-bottom: 15px;">Planilha Idêntica</h3>
          <p style="margin-bottom: 15px;">A planilha enviada é idêntica à lista atual de contatos.<br>Nenhuma alteração será feita.</p>
        </div>
        <div class="modal-confirm-actions">
          <button class="modal-btn-cancel">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-btn-cancel').onclick = () => {
      modal.remove();
    };
  }

  // Mescla contatos importados sem duplicar ramais
  mergeContacts(importedContacts) {
    console.log('Iniciando mesclagem de contatos...');
    console.log('Contatos existentes:', this.contacts.length);
    console.log('Contatos para importar:', importedContacts.length);
    
    const ramaisExistentes = new Set(this.contacts.map(c => c.ramal).filter(r => r));
    console.log('Ramais existentes:', Array.from(ramaisExistentes));
    
    const novos = importedContacts.filter(c => {
      const temRamal = c.ramal && c.ramal.toString().trim() !== '';
      const ramalNovo = !ramaisExistentes.has(c.ramal);
      console.log(`Contato ${c.contato}: ramal=${c.ramal}, temRamal=${temRamal}, ramalNovo=${ramalNovo}`);
      return temRamal && ramalNovo;
    });
    
    console.log('Novos contatos a serem adicionados:', novos.length);
    
    this.contacts = [...this.contacts, ...novos];
    this.saveContactsToStorage();
    this.currentPage = 1;
    this.applySortAndDisplay();
    this.showSuccess(`${novos.length} contatos importados e mesclados com sucesso!`);
  }

  // Substitui todos os contatos pelos importados
  replaceContacts(importedContacts) {
    console.log('Substituindo todos os contatos...');
    console.log('Contatos antigos:', this.contacts.length);
    console.log('Novos contatos:', importedContacts.length);
    
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
    tr.querySelector('.td-cpf').innerHTML = `<input type='text' value='${this.escapeHtml(CPF)}' maxlength='14' style='width:100%'>`;
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
      this.value = formatarCPF(this.value);
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
      if (novoCPF && !validarCPF(novoCPF)) {
        this.showError('CPF inválido.');
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

// Função utilitária para formatar CPF
function formatarCPF(cpf) {
  if (!cpf) return '';
  
  // Remove todos os caracteres não numéricos
  cpf = cpf.toString().replace(/\D/g, '');
  
  // Se não tem 11 dígitos, retorna como está (pode ser um CPF incompleto)
  if (cpf.length !== 11) {
    return cpf;
  }
  
  // Formata no padrão XXX.XXX.XXX-XX
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
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

function initializeClickCall() {
  new ClickCallManager();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeClickCall);
} else {
  initializeClickCall();
}