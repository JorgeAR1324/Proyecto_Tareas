// 1. mportamos los modulos necesarios
const http = require('http');
// importamos la version nativa de promesas del driver para poder usar async /awat de forma limpia 
const mysql = require('mysql2/promise');

//2. CNFIGURACION DE LA CONEXION  MYSQL
//Creamos un 'Pool' de conexiones directas a la base de datos de real
const pool = mysql.createPool({
    host: 'localhost',  // cambiar por 'db' si corre dentro de la red interna de Docker
    user: 'jorge',
    password: 'root',
    database: 'todo_db',
    waitForConnections: true,
    connectionLimit: 10
});

//3. Creamos el servdor HTTP nativo
const server = http.createServer(async (req, res) => {

    // Cabeceras de CORS manuales obligatorias para que el navegador no bloquee el Live server
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

//ENRUTADOR NATIVO CON CONSULTAS SQL REALES

//RUTA 1: obtener tareas (GET /tasks)
if (req.url === '/tasks' && req.method === 'GET') {
    try{
        //Ejecutamos una consulta SQL directa usando interpolacion controlada del driver
        const[rows] = await pool.query('SELECT * FROM tasks');

        res.writeHead(200,{'content-Type': 'applcation/json'});
        res.end(JSON.stringify({
            status: 'success',
            data: { tasks: rows}
        }));
    } catch (error) {
        res.writeHead(500, {'content-type': 'application/json'});
        res.end(JSON.stringify({ status: 'error', message: 'Error en MySQL: ' + error.message}))
    }
    return;
}

// RUTA 2: Crear tarea (POST /tasks)
if (req.url === '/tasks' && req.method === 'POST') {
    let body = '';
    
    //RECONSTRUIMOS EL FLUJO DE DATOS DEL CUERPO (STREAM DATA CHUNKS)
    req.on('data', chunk => {body += chunk.toString();});
    
    //Cuando el paquete se termina de armar, disparamos la insercion asincronica
    req.on('end', async () => {
        try{
            const { title, description, author} = JSON.parse(body);
            
            if(!title || !author) {
                res.writeHead(400, { 'Content-Type': 'application/json'});
                res.end(JSON.stringify({ status: 'error', message: 'Titulo y autor obligatorios'}));
                return;
            }

            // Consulta SQL con marcadoress de posicion (?) para pasar los datos de forma limpia 
            const sql = 'INSERT INTO tasks (title, description, author, is_completed) VALUES (?, ?, ?, 0)';
            const [result] = await pool.query(sql, [title, description || null, author]);
            
            //Construimos el objeto de respuesta usando el D aut-incremental que genero MySQL
            const newTask = {
                id: result.insertId,
                title,
                description: description || null,
                author,
                is_completed: 0
            };

            res.writeHead(201, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ status: 'success', data: { task: newTask }}));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ status: 'error', message: 'Fallo al insertar: ' + error.message}));
        }
    })
    return;
}

// RUTA 3: Actualizar tarea existentee (PUT /tasks/:id)
if (req.url.startsWith('/tasks/') && req.method === 'PUT') {
    const urlParts = req.url.split('/');
    const taskId = parseInt(urlParts[2]);

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', async () => {
        try {
            const { title, description, author, is_completed } = JSON.parse(body);

            // 1. Vlidar si la tarea existe en la base de dats todo_db
            const [rows] = await pool.query('SELECT author FROM tasks WHERE id = ?', [taskId]);

            if (rows.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'La tarea no existe' }));
                return;
            }

            //2. Regla de negocio: Validar propiedad del author
            if(rows[0].author !== author) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'No autroizado, la tarea es de ${rows[0].author}' }));
                return;
            }

            //3. Ejecutar la actualizacion directa en MySQL cn marcadores(?)
            const sql = 'UPDATE tasks SET title = ?, description = ?, is_completed = ? WHERE id = ?';
            await pool.query(sql, [title, description || null, is_completed,taskId]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', data: null }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'Erro en MySQL:' + error.message }));
        }
    });
    return;
}


//RUTA. 4: Eliminar tarea (DELETE /tasks/:id)
if (req.url.startsWith('/tasks/') && req.method === 'DELETE') {
    const urlParts = req.url.split('/');
    const taskId = parseInt(urlParts[2]);

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', async () => {
        try {
            const { author } = JSON.parse(body);

            // Paso A: Consultar a MySQL si la tarea existe y quieen es el dueño
            const [rows] = await pool.query('SELECT author FROM tasks WHERE id = ?', [taskId]);

            if (rows.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'La tarea no existe en la BD' }));
                return;
            }

            const task = rows [0];

            //Logica de proteccion: comparamos el auor de JSON con el autor de la fila de MySQL
            if (task.author !== author) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'No autorizado, la tarea es de ${task.author}' }));
                return;
            }

            // Paso B: Ejecutar la eliminacion directa en MySQL con marcadores (?)P aso B: si pasa el filtro, ejecutamos el borrado fisico en la tabla
            await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', data: null }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'Fallo al eliminar de la BD: ' + error.message }));
        }
    });
    return;
}

//404 - Ruta no encontrada
res.writeHead(404, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({ status: 'error', message: 'Endpoint no    encontrado' }));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor Vanilla con MySQL real corriendo en http://localhost:${PORT}`);
});