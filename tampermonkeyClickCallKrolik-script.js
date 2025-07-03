// ==UserScript==
// @name         ClickCall - Botão Flutuante
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adiciona um botão flutuante com ícone de telefone para acessar o ClickCall
// @author       Você
// @match        *://kip.krolik.com.br/*
// @match        *://*.kip.krolik.com.br/*
// @match        *://ipbx.krolik.com.br/*
// @match        *://*.ipbx.krolik.com.br/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configurações do botão
    const config = {
        url: 'http://clickcall.krolik.com.br:8086/', // Altere para a URL do seu site
        size: '60px',
        position: 'bottom-center', // nova opção personalizada
        color: '#3498db',
        hoverColor: '#2980b9',
        iconColor: '#ffffff',
        zIndex: 9999
    };

    // Criar o botão flutuante
    function createFloatingButton() {
        // Verificar se o botão já existe
        if (document.getElementById('clickcall-floating-btn')) {
            return;
        }

        // Procurar a sidebar
        const sidebar = document.querySelector('.ls-sidebar-inner');
        if (!sidebar) return;

        // Criar o elemento do botão
        const button = document.createElement('div');
        button.id = 'clickcall-floating-btn';
        button.title = 'ClickCall - Lista de Contatos';
        button.innerHTML = `
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="12" fill="#3498db"/>
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99C3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" fill="#fff"/>
            </svg>
        `;

        // CSS para fixar o botão no rodapé da sidebar
        const styles = `
            #clickcall-floating-btn {
                position: fixed;
                width: 50px;
                height: 48px;
                background-color: #3498db;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                transition: all 0.3s ease;
                z-index: 9999;
                border: none;
                outline: none;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                left: 90px; /* Aumente esse valor para mover mais para a direita */
                bottom: 29px;
                animation: slideIn 0.5s ease-out, pulse 2s infinite;
            }

            #clickcall-floating-btn:hover {
                background-color: #2980b9;
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
            }

            #clickcall-floating-btn:active {
                transform: scale(0.95);
            }

            #clickcall-floating-btn svg {
                color: #ffffff;
                width: 28px;
                height: 28px;
            }

            @media (max-width: 768px) {
                #clickcall-floating-btn {
                    width: 50px;
                    height: 50px;
                    left: 16px;
                    bottom: 16px;
                }
                #clickcall-floating-btn svg {
                    width: 22px;
                    height: 22px;
                }
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes pulse {
                0% {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                50% {
                    box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
                }
                100% {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
            }
        `;
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // Evento de clique
        button.addEventListener('click', function(e) {
            e.preventDefault();
            window.open(config.url, '_blank');
        });

        // Adiciona o botão ao final da sidebar
        sidebar.appendChild(button);
    }

    // Função para inicializar o script
    function init() {
        // Aguardar o DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createFloatingButton);
        } else {
            createFloatingButton();
        }

        // Re-criar o botão se a página for atualizada via AJAX (SPA)
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && !document.getElementById('clickcall-floating-btn')) {
                    setTimeout(createFloatingButton, 100);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Inicializar o script
    init();

})(); 