// 1. mportamos los modulos necesarios
const http = require('http');
// importamos la version nativa de promesas del driver para poder usar async /awat de forma limpia 
const mysql = require('mysql2/promise');

//2. CNFIGURACION DE LA CONEXION  MYSQL
//Creamos un 'Pool' de conexiones directas a la base de datos de real
const pool = mysql.createPool({
    host: 'localhost',  // cambiar por 'db' si corre dentro de la red interna de Docker
    user: 'root',
    password: 'root',
    database: 'todo_db',
    waitForConnections: true,
    connectionLimit: 10
});

//3. Creamos el servdor HTTP nativo
const server = http.createServer(async(req, res) => {

    //Cabeceras de CORS mauales obligatorias para que el navegador no bloquee el Live server
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if(req.method === 'options')
    res.writeHead(204);
    res.end()
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

            // Consulta SQL con marcadoress de posicion
