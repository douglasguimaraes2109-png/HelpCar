// 1. CONFIGURAÇÃO DO FIREBASE
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

let usuarioLogado = null;
let perfilUsuario = null;
let historicoIdEmEdicao = null;
let modoCadastro = false;

// 2. GESTÃO DE SESSÃO E CONTROLE DE PERFIL
auth.onAuthStateChanged(async user => {
    const userInfo = document.getElementById('userInfo');
    const btnAuth = document.getElementById('btnAuth');
    const secaoHistorico = document.getElementById('secaoHistorico');
    const secaoOrcamentos = document.getElementById('secaoOrcamentos');

    if (user) {
        usuarioLogado = user;
        
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (userDoc.exists) {
            perfilUsuario = userDoc.data();
            const tipoTexto = perfilUsuario.tipo === 'mecanico' ? '🔧 Oficina/Mecânico' : '🚗 Motorista';
            userInfo.innerHTML = `👤 <strong>${user.email}</strong> (${tipoTexto})`;
        } else {
            userInfo.innerHTML = `👤 <strong>${user.email}</strong>`;
        }

        btnAuth.textContent = "Sair";
        btnAuth.onclick = () => auth.signOut();
        
        if (secaoHistorico) {
            secaoHistorico.style.display = (perfilUsuario?.tipo === 'mecanico') ? 'none' : 'block';
        }
        if (secaoOrcamentos) {
            secaoOrcamentos.style.display = 'block';
        }
        
        carregarHistoricoDoBanco();
        carregarOrcamentos();
    } else {
        usuarioLogado = null;
        perfilUsuario = null;
        userInfo.innerHTML = "Modo Visitante";
        btnAuth.textContent = "Entrar / Cadastrar";
        btnAuth.onclick = abrirModalAuth;
        
        if (secaoHistorico) secaoHistorico.style.display = 'none';
        if (secaoOrcamentos) secaoOrcamentos.style.display = 'none';
    }
});

// 3. CONTROLE DO MODAL DE AUTENTICAÇÃO
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
    const campoPerfil = document.getElementById('campoTipoPerfil');
    const textoTroca = document.getElementById('textoTrocaModo');
    const linkTroca = document.getElementById('linkTrocaModo');

    if (title) title.textContent = modoCadastro ? "Criar Conta" : "Acessar Conta";
    if (btnSubmit) btnSubmit.textContent = modoCadastro ? "Cadastrar" : "Entrar";
    if (campoPerfil) campoPerfil.style.display = modoCadastro ? "block" : "none";
    if (textoTroca) textoTroca.textContent = modoCadastro ? "Já possui uma conta?" : "Ainda não tem uma conta?";
    if (linkTroca) linkTroca.textContent = modoCadastro ? "Entrar" : "Cadastre-se";
}

document.getElementById('formAuth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const senha = document.getElementById('authSenha').value;

    if (modoCadastro) {
        const tipoConta = document.querySelector('input[name="tipoConta"]:checked')?.value || 'cliente';
        try {
            const res = await auth.createUserWithEmailAndPassword(email, senha);
            await db.collection("users").doc(res.user.uid).set({
                email: email,
                tipo: tipoConta,
                dataCadastro: new Date().toLocaleDateString('pt-BR')
            });
            alert("Conta criada com sucesso!");
            fecharModalAuth();
        } catch (err) {
            alert("Erro ao cadastrar: " + err.message);
        }
    } else {
        try {
            await auth.signInWithEmailAndPassword(email, senha);
            fecharModalAuth();
        } catch (err) {
            alert("Erro ao entrar: " + err.message);
        }
    }
});

// 4. API FIPE E CHECKLIST
const API_FIPE_URL = "https://parallelum.com.br/fipe/api/v1/carros";

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

document.addEventListener("DOMContentLoaded", () => {
    carregarMarcas();

    document.getElementById('marca').addEventListener('change', carregarModelos);
    document.getElementById('btnBuscar').addEventListener('click', () => {
        historicoIdEmEdicao = null;
        gerarChecklist();
    });
    document.getElementById('btnExportarPdf').addEventListener('click', () => window.print());
    document.getElementById('btnSalvarHistorico')?.addEventListener('click', salvarHistoricoNoBanco);
    document.getElementById('btnCarregarHistorico')?.addEventListener('click', carregarHistoricoDoBanco);
    document.getElementById('btnSolicitarOrcamento')?.addEventListener('click', solicitarOrcamentoMecanico);
});

async function carregarMarcas() {
    const selectMarca = document.getElementById('marca');
    try {
        const response = await fetch(`${API_FIPE_URL}/marcas`);
        const marcas = await response.json();

        selectMarca.innerHTML = '<option value="">-- Escolha a Marca --</option>';
        marcas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca.codigo;
            option.textContent = marca.nome;
            selectMarca.appendChild(option);
        });
    } catch (error) {
        selectMarca.innerHTML = '<option value="">Erro ao carregar marcas</option>';
    }
}

async function carregarModelos() {
    const codigoMarca = document.getElementById('marca').value;
    const selectModelo = document.getElementById('modelo');

    if (!codigoMarca) {
        selectModelo.innerHTML = '<option value="">Selecione uma marca primeiro</option>';
        selectModelo.disabled = true;
        return;
    }

    selectModelo.disabled = true;
    selectModelo.innerHTML = '<option value="">Carregando modelos...</option>';

    try {
        const response = await fetch(`${API_FIPE_URL}/marcas/${codigoMarca}/modelos`);
        const data = await response.json();

        selectModelo.innerHTML = '<option value="">-- Escolha o Modelo --</option>';
        data.modelos.forEach(modelo => {
            const option = document.createElement('option');
            option.value = modelo.codigo;
            option.textContent = modelo.nome;
            selectModelo.appendChild(option);
        });
        selectModelo.disabled = false;
    } catch (error) {
        selectModelo.innerHTML = '<option value="">Erro ao carregar modelos</option>';
    }
}

function gerarChecklist() {
    const selectMarca = document.getElementById('marca');
    const marcaNome = selectMarca.options[selectMarca.selectedIndex]?.text || '';
    const selectModelo = document.getElementById('modelo');
    const modeloNome = selectModelo.options[selectModelo.selectedIndex]?.text || selectModelo.value;
    
    const kmAtual = Math.abs(parseInt(document.getElementById('km').value)) || 0;
    const listaDiv = document.getElementById('listaManutencao');
    const btnPdf = document.getElementById('btnExportarPdf');
    const btnSalvar = document.getElementById('btnSalvarHistorico');
    const btnOrcamento = document.getElementById('btnSolicitarOrcamento');
    const infoPdf = document.getElementById('infoVeiculoPdf');

    listaDiv.innerHTML = "";

    if (!selectModelo.value || kmAtual <= 0) {
        listaDiv.innerHTML = `<div class="empty-msg">Selecione a marca, o modelo e digite uma quilometragem válida.</div>`;
        if (btnPdf) btnPdf.style.display = 'none';
        if (btnSalvar) btnSalvar.style.display = 'none';
        if (btnOrcamento) btnOrcamento.style.display = 'none';
        return;
    }

    if (infoPdf) {
        infoPdf.innerHTML = `<strong>Veículo:</strong> ${marcaNome} - ${modeloNome} <br><strong>Odômetro:</strong> ${kmAtual.toLocaleString('pt-BR')} km`;
    }

    const pendencias = manutencaoPadrao.filter(item => {
        return (kmAtual % item.kmIntervalo === 0) || (kmAtual >= item.kmIntervalo);
    });

    pendencias.forEach((task, index) => {
        const proximaKm = (Math.floor(kmAtual / task.kmIntervalo) + 1) * task.kmIntervalo;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'task-item';
        itemDiv.id = `task-container-${index}`;

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
        listaDiv.appendChild(itemDiv);

        const checkbox = itemDiv.querySelector(`#check-${index}`);
        checkbox.addEventListener('change', () => {
            itemDiv.classList.toggle('completed', checkbox.checked);
        });
    });

    if (btnPdf) btnPdf.style.display = 'block';
    if (btnSalvar) btnSalvar.style.display = 'block';
    if (btnOrcamento) btnOrcamento.style.display = 'block';
}

// 5. HISTÓRICO DE MANUTENÇÃO
async function salvarHistoricoNoBanco() {
    if (!usuarioLogado) {
        alert("Você precisa estar logado!");
        abrirModalAuth();
        return;
    }

    const selectMarca = document.getElementById('marca');
    const selectModelo = document.getElementById('modelo');
    const kmAtual = Math.abs(parseInt(document.getElementById('km').value)) || 0;

    const checkboxes = document.querySelectorAll('#listaManutencao input[type="checkbox"]:checked');
    const itensConcluidos = Array.from(checkboxes).map(cb => cb.getAttribute('data-title'));

    const dados = {
        veiculo: `${selectMarca.options[selectMarca.selectedIndex]?.text} - ${selectModelo.options[selectModelo.selectedIndex]?.text}`,
        codigoMarca: selectMarca.value,
        codigoModelo: selectModelo.value,
        odometro: kmAtual,
        itensConcluidos: itensConcluidos,
        dataRegistro: new Date().toLocaleDateString('pt-BR')
    };

    try {
        const colecaoRef = db.collection("users").doc(usuarioLogado.uid).collection("historico");

        if (historicoIdEmEdicao) {
            await colecaoRef.doc(historicoIdEmEdicao).update(dados);
            alert("Registro atualizado com sucesso!");
        } else {
            await colecaoRef.add(dados);
            alert("Nova revisão salva no seu histórico!");
        }

        carregarHistoricoDoBanco();
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
}

async function carregarHistoricoDoBanco() {
    if (!usuarioLogado) return;
    const listaDiv = document.getElementById('listaHistorico');
    if (!listaDiv) return;

    listaDiv.innerHTML = "<div style='color: var(--text-dim); font-size: 0.9em;'>Carregando históricos...</div>";

    try {
        const snapshot = await db.collection("users").doc(usuarioLogado.uid).collection("historico").get();

        if (snapshot.empty) {
            listaDiv.innerHTML = "<div class='empty-msg'>Nenhum registro de manutenção salvo ainda.</div>";
            return;
        }

        listaDiv.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const docId = doc.id;

            const card = document.createElement('div');
            card.style.cssText = "background: #0f172a; border: 1px solid var(--border); padding: 12px; border-radius: 8px; margin-bottom: 10px;";

            const itensHtml = data.itensConcluidos && data.itensConcluidos.length > 0 
                ? data.itensConcluidos.map(item => `<li>✓ ${item}</li>`).join('') 
                : '<li style="color: var(--text-dim);">Nenhum item marcado como concluído</li>';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 0.95em; color: var(--accent);">
                    <span>🚗 ${data.veiculo}</span>
                    <span style="color: var(--text-dim); font-size: 0.85em;">📅 ${data.dataRegistro}</span>
                </div>
                <div style="font-size: 0.85em; color: var(--text-dim); margin-top: 4px;">
                    Odômetro: <strong>${data.odometro.toLocaleString('pt-BR')} km</strong>
                </div>
                <ul style="margin: 8px 0; padding-left: 0; font-size: 0.85em; color: #22c55e; list-style-type: none;">
                    ${itensHtml}
                </ul>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button type="button" class="btn-recarregar" style="width: auto; padding: 4px 10px; font-size: 0.8em; background: #0284c7; border:none; border-radius:4px; color:#fff; cursor:pointer;">
                        📂 Carregar
                    </button>
                    <button type="button" class="btn-excluir" style="width: auto; padding: 4px 10px; font-size: 0.8em; background: #ef4444; border:none; border-radius:4px; color:#fff; cursor:pointer;">
                        🗑️ Excluir
                    </button>
                </div>
            `;

            card.querySelector('.btn-recarregar').addEventListener('click', () => recarregarParaFormulario(data, docId));
            card.querySelector('.btn-excluir').addEventListener('click', () => excluirHistoricoDoBanco(docId));

            listaDiv.appendChild(card);
        });
    } catch (error) {
        listaDiv.innerHTML = "Erro ao carregar histórico: " + error.message;
    }
}

async function recarregarParaFormulario(dados, docId) {
    historicoIdEmEdicao = docId;

    document.getElementById('km').value = dados.odometro;
    const selectMarca = document.getElementById('marca');

    if (selectMarca.options.length <= 1) {
        await carregarMarcas();
    }

    if (dados.codigoMarca) {
        selectMarca.value = String(dados.codigoMarca);
    }

    await carregarModelos();
    const selectModelo = document.getElementById('modelo');

    if (dados.codigoModelo) {
        selectModelo.value = String(dados.codigoModelo);
    }

    gerarChecklist();

    if (dados.itensConcluidos && dados.itensConcluidos.length > 0) {
        const checkboxes = document.querySelectorAll('#listaManutencao input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (dados.itensConcluidos.includes(cb.getAttribute('data-title'))) {
                cb.checked = true;
                const container = cb.closest('.task-item');
                if (container) container.classList.add('completed');
            }
        });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirHistoricoDoBanco(docId) {
    if (!confirm("Tem certeza que deseja excluir esta revisão?")) return;

    try {
        await db.collection("users").doc(usuarioLogado.uid).collection("historico").doc(docId).delete();
        alert("Registro excluído com sucesso!");
        carregarHistoricoDoBanco();
    } catch (error) {
        alert("Erro ao excluir: " + error.message);
    }
}

// 6. MÓDULO DE ORÇAMENTOS & CHAMADOS
async function solicitarOrcamentoMecanico() {
    if (!usuarioLogado) {
        alert("Você precisa estar logado para solicitar orçamentos!");
        abrirModalAuth();
        return;
    }

    const selectMarca = document.getElementById('marca');
    const selectModelo = document.getElementById('modelo');
    const kmAtual = Math.abs(parseInt(document.getElementById('km').value)) || 0;
    const checkboxes = document.querySelectorAll('#listaManutencao input[type="checkbox"]:checked');
    const itensPendentes = Array.from(checkboxes).map(cb => cb.getAttribute('data-title'));

    if (itensPendentes.length === 0) {
        alert("Selecione pelo menos um item para cotar!");
        return;
    }

    const observacao = prompt("Observação para as oficinas:");

    try {
        await db.collection("orcamentos").add({
            clienteId: usuarioLogado.uid,
            clienteEmail: usuarioLogado.email,
            veiculo: `${selectMarca.options[selectMarca.selectedIndex]?.text} - ${selectModelo.options[selectModelo.selectedIndex]?.text}`,
            odometro: kmAtual,
            itens: itensPendentes,
            observacao: observacao || "Sem observações",
            status: "Aberto",
            dataCriacao: new Date().toLocaleDateString('pt-BR')
        });

        alert("Chamado enviado!");
        carregarOrcamentos();
    } catch (e) {
        alert("Erro ao abrir chamado: " + e.message);
    }
}

// Variáveis globais para controle do chat aberto
let chatOrcamentoIdAtual = null;
let chatPropostaIdAtual = null;
let unsubscribeChatListener = null;

// 1. Atualizada: Renderização dos chamados com o botão de Abrir Chat
// Função carregarOrcamentos com suporte a Aceitar Proposta / Concluir Chamado
async function carregarOrcamentos() {
    if (!usuarioLogado) return;
    const listaDiv = document.getElementById('listaOrcamentos');
    if (!listaDiv) return;

    listaDiv.innerHTML = "<div style='color: var(--text-dim); font-size: 0.9em;'>Carregando chamados...</div>";

    try {
        let query;
        const eMecanico = perfilUsuario && perfilUsuario.tipo === 'mecanico';

        if (eMecanico) {
            query = db.collection("orcamentos").where("status", "in", ["Aberto", "Proposta Recebida"]);
        } else {
            query = db.collection("orcamentos").where("clienteId", "==", usuarioLogado.uid);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            listaDiv.innerHTML = `<div class='empty-msg'>${eMecanico ? 'Nenhum chamado aberto.' : 'Nenhum chamado pendente.'}</div>`;
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

            // Busca as propostas para este chamado
            const propostasSnapshot = await db.collection("orcamentos").doc(docId).collection("propostas").get();

            if (!propostasSnapshot.empty) {
                propostasHtml = `<div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border);">
                    <strong style="color: #10b981; font-size: 0.85em;">📩 Propostas / Negociações:</strong>`;
                
                propostasSnapshot.forEach(pDoc => {
                    const prop = pDoc.data();
                    const propId = pDoc.id;

                    const podeNegociar = data.clienteId === usuarioLogado.uid || prop.mecanicoId === usuarioLogado.uid;
                    const ehDonoDoChamado = data.clienteId === usuarioLogado.uid;

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

            // Define a cor da tag de status
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

            if (eMecanico && !chamadoFinalizado) {
                card.querySelector('.btn-proposta').addEventListener('click', () => responderOrcamento(docId));
            } else if (data.clienteId === usuarioLogado.uid && !chamadoFinalizado) {
                card.querySelector('.btn-cancelar-orcamento').addEventListener('click', () => cancelarOrcamento(docId));
            }

            listaDiv.appendChild(card);
        }

    } catch (e) {
        listaDiv.innerHTML = "Erro ao carregar chamados: " + e.message;
    }
}

// 2. Lógica de Abertura e Envio de Mensagens no Chat
function abrirModalChat(orcamentoId, propostaId) {
    chatOrcamentoIdAtual = orcamentoId;
    chatPropostaIdAtual = propostaId;

    document.getElementById('modalChat').style.display = 'flex';
    ouvirMensagensChat();
}

function fecharModalChat() {
    document.getElementById('modalChat').style.display = 'none';
    if (unsubscribeChatListener) {
        unsubscribeChatListener(); // Cancela o listener em tempo real para economizar dados
    }
}

function ouvirMensagensChat() {
    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML = "<div class='empty-msg'>Carregando mensagens...</div>";

    const chatRef = db.collection("orcamentos")
                      .doc(chatOrcamentoIdAtual)
                      .collection("propostas")
                      .doc(chatPropostaIdAtual)
                      .collection("mensagens")
                      .orderBy("timestamp", "asc");

    // O onSnapshot atualiza as mensagens em tempo real
    unsubscribeChatListener = chatRef.onSnapshot((snapshot) => {
        if (snapshot.empty) {
            chatBox.innerHTML = "<div class='empty-msg'>Nenhuma mensagem enviada ainda. Digite abaixo para negociar!</div>";
            return;
        }

        chatBox.innerHTML = "";
        snapshot.forEach(doc => {
            const msg = doc.data();
            const souEu = msg.remetenteId === usuarioLogado.uid;

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

    if (!texto || !chatOrcamentoIdAtual || !chatPropostaIdAtual) return;

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

// Função para fechar o chamado com a proposta escolhida
async function finalizarChamado(orcamentoId, oficinaEscolhida) {
    const confirmacao = confirm(`Deseja aceitar a proposta da oficina ${oficinaEscolhida} e marcar o chamado como Resolvido?`);
    
    if (!confirmacao) return;

    try {
        await db.collection("orcamentos").doc(orcamentoId).update({
            status: "Resolvido",
            oficinaEscolhida: oficinaEscolhida,
            dataResolvido: new Date().toLocaleDateString('pt-BR')
        });

        alert("Chamado concluído com sucesso!");
        carregarOrcamentos(); // Recarrega a lista para atualizar a interface
    } catch (error) {
        alert("Erro ao finalizar chamado: " + error.message);
    }
}
