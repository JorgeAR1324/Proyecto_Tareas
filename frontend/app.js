//1. CONFIGURACION GLOBAL (Apunta a tu servidor nativo)
const API_URL = 'http://localhost:3000/tasks';

//Intentamos leer si ya existe un nombre guardado en el disco del navegador
let AUTHOR = localStorage.getItem('todo_author_session');

//2. CAPTURA CENTRALIZADA DE ELEMENTOS DEL DOM
const currentUserText = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');
const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskDescription = document.getElementById('taskDescription');
const taskContainer = document.getElementById('taskContainer');

//2.1 SELECTORES DE MODALES PERSONALIZADOS
const customModal = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginInput = document.getElementById('loginInput');

//2.2 CONTROLADOR ASINCORNICO DE MODAL DE NOTIFICACIONES
function openCustomModal(title, message,isConfirm = false, onConfirmCallback = null) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    modalCancelBtn.style.display = isConfirm ? 'block' : 'none';
    customModal.classList.add('active');

    const nuevoConfirmBtn = modalConfirmBtn.cloneNode(true);
    const nuevoCancelBtn = modalCancelBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(nuevoConfirmBtn, modalConfirmBtn);
    modalCancelBtn.parentNode.replaceChild(nuevoCancelBtn, modalCancelBtn);

    nuevoConfirmBtn.addEventListener('click', () => {
        customModal.classList.remove('active');
        if (onConfirmCallback) onConfirmCallback();
    });

    nuevoCancelBtn.addEventListener('click', () => {
        customModal.classList.remove('active');
    });
}

//3. GUARDIA DE AUTENTICACION (Manipulacion de Modales de Flujo)
function checkAuth() {
    if (!AUTHOR) {
        loginModal.classList.add('active');
    } else {
        loginModal.classList.remove('active');
        currentUserText.textContent = AUTHOR;
        fetchTasks(); //Cargamos las tareas solo si ya esta identificado
    }
}

// 3.1 ESCUCHADOR PARA EL FORMULARIO INTERNO DEL MODAL LOGIN
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = loginInput.value.trim();

    if (name && name.length >= 2){
        AUTHOR = name;
        localStorage.setItem('todo_author_session', AUTHOR);
        loginModal.classList.remove('active');
        currentUserText.textContent = AUTHOR;
        fetchTasks();
        } else {
            openCustomModal('Validacion', 'Por favor ingrese un nombre valido (minimo 2 caracteres).', false);
        }
})

//4. LEER TAREAS DESDE MYSQL (GET)
async function fetchTasks() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();

        if (json.status === 'success' && json.data.tasks) {
            renderTasks(json.data.tasks);
        }
    } catch (error) {
        console.error('Error de red:', error);
        taskContainer.innerHTML = `<p class="error"> No se pudo conectar con el servidor nativo </p>`;
    }
}

//5. PINTAR LAS TARJETAS DINAMICAMENTE
function renderTasks(tasks) {
    taskContainer.innerHTML = '';
    
    if (tasks.length === 0) {
        taskContainer.innerHTML = '<p class="empty">No hay tareas pendientes en la base de datos.</p>';
        return;
    }

    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = `task-card ${task.is_completed ? 'completed' : ''}`;

        const setHtmlModoLectura = () => {
            taskCard.innerHTML = `
                <div class = "task-info">
                    <h3>${task.title}</h3>
                    <p>${task.description || ''}</p>
                    <span class="author">Autor: ${task.author}</span>
                </div>
                <div class="task-actions" style="display: flex; gap: 5px;">
                    <button class="btn-edit" style="background-color: #2463eb; font-size: 0.85rem; width: auto; padding: 5px 10px; color: white; border: none; border-radius: 4px; cursor: pointer;">Editar</button>
                    <button class="btn-delete" style="background-color: #dc2626; font-size: 0.85rem; width: auto; padding: 5px 10px; color: white; border: none; border-radius: 4px; cursor: pointer;">Eliminar</button>
                </div>
                `;

                taskCard.querySelector('.btn-delete').addEventListener('click', () => deleteTask(task.id, task.author));
                taskCard.querySelector('.btn-edit').addEventListener('click', () => cambiarAModoEdicion(task, taskCard));
            };

            setHtmlModoLectura();
            taskContainer.appendChild(taskCard);
        });
}

// 5.1 INTERFAZ DINAMICA: MODO EDICION INLINE
function cambiarAModoEdicion(task, taskCard) {
    if (AUTHOR !== task.author) {
        openCustomModal('Acceso Restringido', `¡No autorizado! Esta tarea le pertenece a "${task.author}" y tu eres "${AUTHOR}"`, false);
        return;
    }

    taskCard.innerHTML = `
        <div class="task-edit-form" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <input type="text" class="edit-title" value="${task.title}" style="padding: 5px; border: 1px solid #2563eb; border-radius: 4px;">
            <textarea class="edit-desc" style="padding: 5px; border: 1px solid #2563eb; border-radius: 4px; resize: none;">${task.description || ''}</textarea>
            <div style="display: flex; gap: 5px; justify-content: flex-end;">
                <button class="btn-cancel-edit" style="background-color: #6b7280; font-size: 0.85rem; width: auto; padding: 5px 10px; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
                <button class="btn-save-edit" style="background-color: #10b981; font-size: 0.85rem; width: auto; padding: 5px 10px; color: white; border: none; border-radius: 4px; cursor: pointer;">Guardar</button>
            </div>
        </div>
    `;

    const btnCancelar = taskCard.querySelector('.btn-cancel-edit');
    const btnGuardar = taskCard.querySelector('.btn-save-edit');

    btnCancelar.addEventListener('click', () => fetchTasks());

    btnGuardar.addEventListener('click', () => {
        const nuevoTitulo = taskCard.querySelector('.edit-title').value.trim();
        const nuevaDescripcion = taskCard.querySelector('.edit-desc').value.trim();

        if (!nuevoTitulo) {
            openCustomModal('Validación', 'El título de la tarea es obligatorio.', false);
            return;
        }

        updateTask(task.id, nuevoTitulo, nuevaDescripcion, task.is_completed);
    });
}

// 6. CREAR TAREA (POST)
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = taskTitle.value.trim();
    const description = taskDescription.value.trim();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, author: AUTHOR })
        });

        if (response.ok) {
            taskForm.reset();
            fetchTasks();
        }
    } catch (error) {
        openCustomModal('Error de Red', 'Error de red al intentar crear la tarea.', false);
    }
});

// 7. ACTUALIZAR TAREA (PUT)
async function updateTask(id, title, description, is_completed) {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({title, description, is_completed, author: AUTHOR })
        });

        const json = await response.json();

        if (response.ok && json.status === 'success') {
            fetchTasks();
        } else {
            openCustomModal('Error de Servidor', json.message || 'Error al actualizar en el servidor', false);
        }
    } catch (error) {
        openCustomModal('Error de Red', 'Error al comunicar la actualización.', false);
    }
}

// 8. ELIMINAR LA TAREA (DELETE)
async function deleteTask(id, taskAuthor) {
    if (AUTHOR !== taskAuthor) {
        openCustomModal('Acceso Denegado', `¡No autorizado! Esta tarea es de "${taskAuthor}"`, false);
        return;
    }

    openCustomModal(
        '¿Confirmar Eliminación?',
        '¿Estás seguro de eliminar esta tarea de la base de datos de manera permanente?',
        true,
        async () => {
            try {
                const response = await fetch(`${API_URL}/${id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({author: AUTHOR})
                });

                const json = await response.json();

                if (response.ok && json.status === 'success') {
                    fetchTasks();
                } else {
                    openCustomModal('Error de Servidor', json.message || 'Fallo de autorización en el servidor', false);
                }
            } catch (error) {
                openCustomModal('Error de Red', 'Error de red al eliminar la tarea.', false);
            }
        }
    );
}

// 9. CERRAR SESIÓN (LOGOUT)
logoutBtn.addEventListener('click',() => {
    localStorage.removeItem('todo_author_session');
    window.location.reload();
});

// === INICIALIZACIÓN AL ABRIR LA PAGINA ===
checkAuth();