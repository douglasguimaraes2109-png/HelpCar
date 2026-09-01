// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAr2WewAfeddazQLBpV-JId3Tmq9Tx8s_M",
  authDomain: "helpcardb.firebaseapp.com",
  projectId: "helpcardb",
  storageBucket: "helpcardb.firebasestorage.app",
  messagingSenderId: "865693923703",
  appId: "1:865693923703:web:7f41059397c44ff85e4972",
  measurementId: "G-J33QTYLZN6"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variáveis Globais de Estado
let usuarioLogado = null;
let perfilUsuario = null;
let historicoIdEmEdicao = null;
let modoCadastro = false;
let chatOrcamentoIdAtual = null;
let chatPropostaIdAtual = null;
let unsubscribeChatListener = null;

const FIPE_API_URL = "https://parallelum.com.br/fipe/api/v1/carros";

const manutencaoPadrao = [
    { kmIntervalo: 10000, item: "Troca de Óleo do Motor + Filtro", desc: "Verificar especificação e viscosidade recomendada no manual.", cat: "Básico" },
    { kmIntervalo: 10000, item: "Filtro de Ar do Motor e Combustível", desc: "Substituição para evitar consumo excessivo de combustível.", cat: "Injeção" },
    { kmIntervalo: 20000, item: "Velas de Ignição", desc: "Checar desgaste dos eletrodos para garantir boa queima.", cat: "Ignição" },
    { kmIntervalo: 20000, item: "Pastilhas de Freio e Fluido DOT4", desc: "Inspecionar espessura das pastilhas e contaminação do fluido.", cat: "Freios" },
    { kmIntervalo: 30000, item: "Limpeza do Sistema de Arrefecimento", desc: "Troca do líquido com aditivo na proporção correta.", cat: "Arrefecimento" },
    { kmIntervalo: 40000, item: "Correia Dentada e Tensor (se aplicável)", desc: "Verificação preventiva essencial para evitar quebra do motor.", cat: "Motor" },
    { kmIntervalo: 50000, item: "Amortecedores e Kit Suspensão", desc: "Avaliar vazamentos, folgas em buchas, pivôs e bieletas.", cat: "Suspensão" },
    { kmIntervalo: 80000, item: "Kit de Embreagem / Fluido do Câmbio", desc: "Checar altura do pedal ou troca de fluido da transmissão.", cat: "Transmissão" }
];

// ==========================================
// OBSERVADOR DE AUTENTICAÇÃO EM TEMPO REAL
// ==========================================
auth.onAuthStateChanged(async user => {
    const userStatus = document.getElementById('userStatus');
    const btnOpenAuth = document.getElementById('btnOpenAuth');
    const secaoOrcamentos = document.getElementById('secaoOrcamentos');

    if (user) {
        usuarioLogado = user;
        
        try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            if (userDoc.exists) {
                perfilUsuario = userDoc.data();
                const tipoTexto = perfilUsuario.tipo === 'mecanico' ? '🔧 Oficina/Mecânico' : '🚗 Motorista';
                if (userStatus) userStatus.innerHTML = `👤 <strong>${user.email}</strong> (${tipoTexto})`;
            } else {
                if (userStatus) userStatus.innerHTML = `👤 <strong>${user.email}</strong>`;
            }
        } catch (err) {
            if (userStatus) userStatus.innerHTML = `👤 <strong>${user.email}</strong>`;
        }

        if (btnOpenAuth) {
            btnOpenAuth.textContent = "Sair";
            btnOpenAuth.onclick = () => auth.signOut();
        }
        
        if (secaoOrcamentos) secaoOrcamentos.style.display = 'block';
        
        carregarOrcamentos();
    } else {
        usuarioLogado = null;
        perfilUsuario = null;
        if (userStatus) userStatus.innerHTML = "Modo Visitante";
        if (btnOpenAuth) {
            btnOpenAuth.textContent = "Entrar / Cadastrar";
            btnOpenAuth.onclick = abrirModalAuth;
        }
        if (secaoOrcamentos) secaoOrcamentos.style.display = 'block';
    }
});

// ==========================================
// CONTROLE DO MODAL DE AUTENTICAÇÃO
// ==========================================
function abrirModalAuth() {
    modoCadastro = false;
    atualizarCamposModal();
    const modal = document.getElementById('modalAuth');
    if (modal) modal.style.display = 'flex';
}

function fecharModalAuth() {
    const modal = document.getElementById('modalAuth');
    if (modal) modal.style.display = 'none';
}

function alternarModoAuth(e) {
    if (e) e.preventDefault();
    modoCadastro = !modoCadastro;
    atualizarCamposModal();
}

function atualizarCamposModal() {
    const title = document.getElementById('modalTitle');
    const btnSubmit = document.getElementById('btnSubmitAuth');
    const grupoTipoUsuario = document.getElementById('grupoTipoUsuario');
    const textToggleAuth = document.getElementById('textToggleAuth');
    const linkToggleAuth = document.getElementById('linkToggleAuth');

    if (title) title.textContent = modoCadastro ? "Criar Conta" : "Acessar Conta";
    if (btnSubmit) btnSubmit.textContent = modoCadastro ? "Cadastrar" : "Entrar";
    if (grupoTipoUsuario) grupoTipoUsuario.style.display = modoCadastro ? "block" : "none";
    if (textToggleAuth) textToggleAuth.textContent = modoCadastro ? "Já possui uma conta?" : "Ainda não tem uma conta?";
    if (linkToggleAuth) linkToggleAuth.textContent = modoCadastro ? "Entrar" : "Cadastre-se";
}

document.getElementById('formAuth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const senha = document.getElementById('authPassword').value;
    const btnSubmit = document.getElementById('btnSubmitAuth');

    if (btnSubmit) btnSubmit.disabled = true;

    if (modoCadastro) {
        const tipoUsuario = document.querySelector('input[name="tipoUsuario"]:checked')?.value || 'motorista';
        try {
            const res = await auth.createUserWithEmailAndPassword(email, senha);
            await db.collection("users").doc(res.user.uid).set({
                email: email,
                tipo: tipoUsuario,
                dataCadastro: new Date().toLocaleDateString('pt-BR')
            });
            alert("Conta criada com sucesso!");
            fecharModalAuth();
        } catch (err) {
            tratarErrosFirebase(err);
        }
    } else {
        try {
            await auth.signInWithEmailAndPassword(email, senha);
            fecharModalAuth();
        } catch (err) {
            tratarErrosFirebase(err);
        }
    }

    if (btnSubmit) btnSubmit.disabled = false;
});

function tratarErrosFirebase(error) {
    console.error("Erro na Autenticação:", error);
    switch (error.code) {
        case 'auth/user-not-found':
            alert("Usuário não encontrado. Verifique o e-mail digitado.");
            break;
        case 'auth/wrong-password':
            alert("Senha incorreta.");
            break;
        case 'auth/invalid-email':
            alert("E-mail com formato inválido.");
            break;
        case 'auth/email-already-in-use':
            alert("Este e-mail já está cadastrado.");
            break;
        case 'auth/weak-password':
            alert("A senha deve ter pelo menos 6 caracteres.");
            break;
        default:
            alert("Erro na autenticação: " + error.message);
    }
}

// ==========================================
// API DA FIPE E BUSCA DE VEÍCULOS
// ==========================================
async function carregarMarcasAPI() {
    const selectMarca = document.getElementById('selectMarca');
    const selectModelo = document.getElementById('selectModelo');

    if (!selectMarca || !selectModelo) return;

    selectMarca.innerHTML = '<option value="">Carregando marcas...</option>';
    selectMarca.disabled = true;

    try {
        const response = await fetch(`${FIPE_API_URL}/marcas`);
        const marcas = await response.json();

        selectMarca.innerHTML = '<option value="">-- Escolha a Marca --</option>';
        marcas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca.codigo;
            option.dataset.nome = marca.nome;
            option.textContent = marca.nome;
            selectMarca.appendChild(option);
        });

        selectMarca.disabled = false;
    } catch (error) {
        console.error("Erro FIPE:", error);
        selectMarca.innerHTML = '<option value="">Erro ao carregar marcas</option>';
    }
}

async function carregarModelosAPI(codigoMarca) {
    const selectModelo = document.getElementById('selectModelo');
    if (!selectModelo) return;

    selectModelo.innerHTML = '<option value="">Carregando modelos...</option>';
    selectModelo.disabled = true;

    try {
        const response = await fetch(`${FIPE_API_URL}/marcas/${codigoMarca}/modelos`);
        const data = await response.json();

        selectModelo.innerHTML = '<option value="">-- Escolha o Modelo --</option>';
        data.modelos.forEach(modelo => {
            const option = document.createElement('option');
            option.value = modelo.nome;
            option.textContent = modelo.nome;
            selectModelo.appendChild(option);
        });

        selectModelo.disabled = false;
    } catch (error) {
        console.error("Erro FIPE:", error);
        selectModelo.innerHTML = '<option value="">Erro ao carregar modelos</option>';
    }
}

// ==========================================
// CHECKLIST DE MANUTENÇÃO
// ==========================================
function gerarChecklist() {
    const selectMarca = document.getElementById('selectMarca');
    const selectModelo = document.getElementById('selectModelo');
    const inputKm = document.getElementById('inputKm');
    const listaItens = document.getElementById('listaItens');
    const acoesChecklist = document.getElementById('acoesChecklist');

    if (!selectModelo.value || !inputKm.value || inputKm.value <= 0) {
        alert("Por favor, selecione a marca, modelo e insira uma quilometragem válida.");
        return;
    }

    const kmAtual = Math.abs(parseInt(inputKm.value)) || 0;
    listaItens.innerHTML = "";

    const pendencias = manutencaoPadrao.filter(item => {
        return (kmAtual % item.kmIntervalo === 0) || (kmAtual >= item.kmIntervalo);
    });

    if (pendencias.length === 0) {
        listaItens.innerHTML = "<div class='empty-msg'>Nenhuma manutenção necessária para esta quilometragem!</div>";
        if (acoesChecklist) acoesChecklist.style.display = 'none';
        return;
    }

    pendencias.forEach((task, index) => {
        const proximaKm = (Math.floor(kmAtual / task.kmIntervalo) + 1) * task.kmIntervalo;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'task-item';

        itemDiv.innerHTML = `
            <input type="checkbox" id="check-${index}" data-title="${task.item}">
            <div class="task-content">
                <label for="check-${index}" class="task-title">${task.item}</label>
                <div class="task-desc">${task.desc}</div>
                <div style="margin-top: 6px;">
                    <span class="task-tag">${task.cat} • A cada ${task.kmIntervalo.toLocaleString('pt-BR')} km</span>
                    <span class="proxima-revisao-tag">📌 Próxima troca: <strong>${proximaKm.toLocaleString('pt-BR')} km</strong></span>
                </div>
            </div>
        `;
        listaItens.appendChild(itemDiv);

        const checkbox = itemDiv.querySelector(`#check-${index}`);
        checkbox.addEventListener('change', () => {
            itemDiv.classList.toggle('completed', checkbox.checked);
        });
    });

    if (acoesChecklist) acoesChecklist.style.display = 'flex';
}

// ==========================================
// MURAL DE CHAMADOS / ORÇAMENTOS & CHAT
// ==========================================
async function solicitarOrcamentoMecanico() {
    if (!usuarioLogado) {
        alert("Você precisa estar logado para solicitar orçamentos!");
        abrirModalAuth();
        return;
    }

    const selectMarca = document.getElementById('selectMarca');
    const selectModelo = document.getElementById('selectModelo');
    const inputKm = document.getElementById('inputKm');
    const checkboxes = document.querySelectorAll('#listaItens input[type="checkbox"]:checked');
    const itensPendentes = Array.from(checkboxes).map(cb => cb.getAttribute('data-title'));

    if (itensPendentes.length === 0) {
        alert("Selecione pelo menos um item da checklist para cotar!");
        return;
    }

    const marcaNome = selectMarca.options[selectMarca.selectedIndex]?.text || '';
    const modeloNome = selectModelo.value;
    const kmAtual = Math.abs(parseInt(inputKm.value)) || 0;
    const observacao = prompt("Alguma observação para os mecânicos/oficinas?");

    try {
        await db.collection("orcamentos").add({
            clienteId: usuarioLogado.uid,
            clienteEmail: usuarioLogado.email,
            veiculo: `${marcaNome} - ${modeloNome}`,
            odometro: kmAtual,
            itens: itensPendentes,
            observacao: observacao || "Sem observações",
            status: "Aberto",
            dataCriacao: new Date().toLocaleDateString('pt-BR')
        });

        alert("Solicitação enviada para o mural com sucesso!");
        carregarOrcamentos();
    } catch (e) {
        alert("Erro ao abrir solicitação: " + e.message);
    }
}

async function carregarOrcamentos() {
    const listaDiv = document.getElementById('listaOrcamentos');
    if (!listaDiv) return;

    listaDiv.innerHTML = "<div class='empty-msg'>Carregando chamados...</div>";

    try {
        let query;
        const eMecanico = perfilUsuario && perfilUsuario.tipo === 'mecanico';

        if (!usuarioLogado) {
            query = db.collection("orcamentos").limit(10);
        } else if (eMecanico) {
            query = db.collection("orcamentos").where("status", "in", ["Aberto", "Proposta Recebida"]);
        } else {
            query = db.collection("orcamentos").where("clienteId", "==", usuarioLogado.uid);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            listaDiv.innerHTML = `<div class='empty-msg'>${eMecanico ? 'Nenhum chamado aberto de clientes.' : 'Nenhum chamado aberto.'}</div>`;
            return;
        }

        listaDiv.innerHTML = "";
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const docId = doc.id;
            const chamadoFinalizado = data.status === "Resolvido" || data.status === "Cancelado";

            const card = document.createElement('div');
            card.style.cssText = `background: #0f172a; border: 1px solid var(--border); padding: 14px; border-radius: 8px; margin-bottom: 12px; ${chamadoFinalizado ? 'opacity: 0.7;' : ''}`;

            let acoesHtml = "";
            let propostasHtml = "";

            const propostasSnapshot = await db.collection("orcamentos").doc(docId).collection("propostas").get();

            if (!propostasSnapshot.empty) {
                propostasHtml = `<div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border);">
                    <strong style="color: #10b981; font-size: 0.85em;">📩 Propostas / Negociações:</strong>`;
                
                propostasSnapshot.forEach(pDoc => {
                    const prop = pDoc.data();
                    const propId = pDoc.id;

                    const podeNegociar = usuarioLogado && (data.clienteId === usuarioLogado.uid || prop.mecanicoId === usuarioLogado.uid);
                    const ehDonoDoChamado = usuarioLogado && (data.clienteId === usuarioLogado.uid);

                    propostasHtml += `
                        <div style="background: #1e293b; padding: 10px; border-radius: 6px; margin-top: 8px; font-size: 0.85em;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold; color: #f8fafc;">
                                <span>🔧 ${prop.mecanicoEmail}</span>
                                <span style="color: #10b981;">R$ ${Number(prop.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div style="color: var(--text-dim); margin-top: 4px;">"${prop.mensagem}"</div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; flex-wrap: wrap; gap: 6px;">
                                <span style="font-size: 0.75em; color: var(--text-dim);">Enviado em: ${prop.dataEnviado}</span>
                                <div style="display: flex; gap: 6px;">
                                    ${podeNegociar ? `<button type="button" onclick="abrirModalChat('${docId}', '${propId}')" style="background: #3b82f6; border: none; border-radius: 4px; color: #fff; padding: 4px 8px; font-size: 0.80em; cursor: pointer;">💬 Chat</button>` : ''}
                                    ${(ehDonoDoChamado && !chamadoFinalizado) ? `<button type="button" onclick="finalizarChamado('${docId}', '${prop.mecanicoEmail}')" style="background: #10b981; border: none; border-radius: 4px; color: #fff; padding: 4px 8px; font-size: 0.80em; cursor: pointer;">✅ Aceitar Proposta</button>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                propostasHtml += `</div>`;
            }

            if (usuarioLogado) {
                if (eMecanico && !chamadoFinalizado) {
                    acoesHtml = `
                        <button type="button" class="btn-proposta" style="width: auto; padding: 6px 12px; font-size: 0.8em; background: #10b981; border:none; border-radius:4px; color:#fff; cursor:pointer; margin-top: 10px;">
                            💬 Enviar Proposta
                        </button>
                    `;
                } else if (data.clienteId === usuarioLogado.uid && !chamadoFinalizado) {
                    acoesHtml = `
                        <button type="button" class="btn-cancelar-orcamento" style="width: auto; padding: 6px 12px; font-size: 0.8em; background: #ef4444; border:none; border-radius:4px; color:#fff; cursor:pointer; margin-top: 10px;">
                            ❌ Cancelar Chamado
                        </button>
                    `;
                }
            }

            let corStatus = "#334155";
            if (data.status === "Resolvido") corStatus = "#10b981";
            if (data.status === "Cancelado") corStatus = "#ef4444";

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; color: #f59e0b; font-weight: bold; font-size: 0.9em;">
                    <span>📋 Chamado #${docId.substring(0, 5)} - ${data.veiculo}</span>
                    <span style="background: ${corStatus}; padding: 2px 8px; border-radius: 4px; color: #fff; font-size: 0.8em;">${data.status}</span>
                </div>
                <div style="font-size: 0.8em; color: var(--text-dim); margin-top: 4px;">
                    Cliente: ${data.clienteEmail} | Odômetro: ${data.odometro.toLocaleString('pt-BR')} km
                </div>
                <div style="font-size: 0.85em; margin-top: 6px;">
                    <strong>Itens Solicitados:</strong> ${data.itens.join(', ')}
                </div>
                <div style="font-size: 0.8em; color: var(--text-dim); font-style: italic; margin-top: 4px;">
                    "${data.observacao}"
                </div>
                ${propostasHtml}
                ${acoesHtml}
            `;

            if (usuarioLogado) {
                if (eMecanico && !chamadoFinalizado) {
                    card.querySelector('.btn-proposta')?.addEventListener('click', () => responderOrcamento(docId));
                } else if (data.clienteId === usuarioLogado.uid && !chamadoFinalizado) {
                    card.querySelector('.btn-cancelar-orcamento')?.addEventListener('click', () => cancelarOrcamento(docId));
                }
            }

            listaDiv.appendChild(card);
        }

    } catch (e) {
        listaDiv.innerHTML = "<div class='empty-msg'>Erro ao carregar chamados: " + e.message + "</div>";
    }
}

// Chat e Mensagens da Proposta
function abrirModalChat(orcamentoId, propostaId) {
    chatOrcamentoIdAtual = orcamentoId;
    chatPropostaIdAtual = propostaId;

    const modalChat = document.getElementById('modalChat');
    if (modalChat) modalChat.style.display = 'flex';
    ouvirMensagensChat();
}

function fecharModalChat() {
    const modalChat = document.getElementById('modalChat');
    if (modalChat) modalChat.style.display = 'none';
    if (unsubscribeChatListener) unsubscribeChatListener();
}

function ouvirMensagensChat() {
    const chatBox = document.getElementById('chatMessages');
    if (!chatBox) return;

    chatBox.innerHTML = "<div class='empty-msg'>Carregando mensagens...</div>";

    const chatRef = db.collection("orcamentos")
                      .doc(chatOrcamentoIdAtual)
                      .collection("propostas")
                      .doc(chatPropostaIdAtual)
                      .collection("mensagens")
                      .orderBy("timestamp", "asc");

    unsubscribeChatListener = chatRef.onSnapshot((snapshot) => {
        if (snapshot.empty) {
            chatBox.innerHTML = "<div class='empty-msg'>Nenhuma mensagem enviada ainda. Digite abaixo para negociar!</div>";
            return;
        }

        chatBox.innerHTML = "";
        snapshot.forEach(doc => {
            const msg = doc.data();
            const souEu = usuarioLogado && msg.remetenteId === usuarioLogado.uid;

            const balao = document.createElement('div');
            balao.style.cssText = `
                max-width: 80%;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 0.85em;
                align-self: ${souEu ? 'flex-end' : 'flex-start'};
                background: ${souEu ? '#2563eb' : '#334155'};
                color: #ffffff;
            `;

            balao.innerHTML = `
                <div style="font-size: 0.75em; opacity: 0.8; margin-bottom: 2px;">${msg.remetenteEmail}</div>
                <div>${msg.texto}</div>
                <div style="font-size: 0.65em; opacity: 0.6; text-align: right; margin-top: 4px;">${msg.hora || ''}</div>
            `;
            chatBox.appendChild(balao);
        });

        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

document.getElementById('formChat')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const texto = input.value.trim();

    if (!texto || !chatOrcamentoIdAtual || !chatPropostaIdAtual || !usuarioLogado) return;

    input.value = "";

    try {
        await db.collection("orcamentos")
                .doc(chatOrcamentoIdAtual)
                .collection("propostas")
                .doc(chatPropostaIdAtual)
                .collection("mensagens")
                .add({
                    remetenteId: usuarioLogado.uid,
                    remetenteEmail: usuarioLogado.email,
                    texto: texto,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                });
    } catch (err) {
        alert("Erro ao enviar mensagem: " + err.message);
    }
});

async function responderOrcamento(orcamentoId) {
    const valor = prompt("Digite o valor estimado (R$):");
    if (!valor) return;

    const mensagem = prompt("Detalhes da proposta:");

    try {
        await db.collection("orcamentos").doc(orcamentoId).collection("propostas").add({
            mecanicoId: usuarioLogado.uid,
            mecanicoEmail: usuarioLogado.email,
            valor: parseFloat(valor),
            mensagem: mensagem || "Sem detalhes adicionais",
            dataEnviado: new Date().toLocaleDateString('pt-BR')
        });

        await db.collection("orcamentos").doc(orcamentoId).update({ status: "Proposta Recebida" });

        alert("Proposta enviada!");
        carregarOrcamentos();
    } catch (e) {
        alert("Erro ao enviar proposta: " + e.message);
    }
}

async function cancelarOrcamento(orcamentoId) {
    if (!confirm("Tem certeza que deseja cancelar?")) return;

    try {
        await db.collection("orcamentos").doc(orcamentoId).delete();
        alert("Chamado cancelado!");
        carregarOrcamentos();
    } catch (e) {
        alert("Erro ao cancelar: " + e.message);
    }
}

async function finalizarChamado(orcamentoId, oficinaEscolhida) {
    if (!confirm(`Deseja aceitar a proposta da oficina ${oficinaEscolhida} e marcar o chamado como Resolvido?`)) return;

    try {
        await db.collection("orcamentos").doc(orcamentoId).update({
            status: "Resolvido",
            oficinaEscolhida: oficinaEscolhida,
            dataResolvido: new Date().toLocaleDateString('pt-BR')
        });

        alert("Chamado concluído com sucesso!");
        carregarOrcamentos();
    } catch (error) {
        alert("Erro ao finalizar chamado: " + error.message);
    }
}

// ==========================================
// INICIALIZAÇÃO DA PÁGINA (EVENT LISTENERS)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa FIPE
    carregarMarcasAPI();

    const selectMarca = document.getElementById('selectMarca');
    const selectModelo = document.getElementById('selectModelo');

    if (selectMarca) {
        selectMarca.addEventListener('change', (e) => {
            const codigoMarca = e.target.value;
            if (codigoMarca) {
                carregarModelosAPI(codigoMarca);
            } else {
                selectModelo.innerHTML = '<option value="">Selecione a marca primeiro</option>';
                selectModelo.disabled = true;
            }
        });
    }

    // 2. Modais e Botões de Autenticação
    document.getElementById('btnOpenAuth')?.addEventListener('click', abrirModalAuth);
    document.getElementById('btnCloseAuth')?.addEventListener('click', fecharModalAuth);
    document.getElementById('linkToggleAuth')?.addEventListener('click', alternarModoAuth);

    // 3. Ações do Checklist
    document.getElementById('btnGerarChecklist')?.addEventListener('click', gerarChecklist);
    document.getElementById('btnSolicitarOrcamento')?.addEventListener('click', solicitarOrcamentoMecanico);
});