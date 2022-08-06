const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
//const fs = require('fs')
const initSqlJs = require('sql.js');
//const initSqlJs = require('sql-wasm.js');
//const util = require('util')
//const childProcess = require('child_process');

function createWindow () {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        //transparent: true, // 透過
        //opacity: 0.3,
        //frame: false,      // フレームを非表示にする
        webPreferences: {
            nodeIntegration: false,
            enableRemoteModule: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    mainWindow.loadFile('index.html')
    //mainWindow.setMenuBarVisibility(false);
    mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
    createWindow()
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// ここではdb.execを参照できるが、return後では参照できない謎
ipcMain.handle('loadDb', async (event, filePath) => {
    console.log('----- loadDb ----- ', filePath)
    const fs = require('fs')
    const SQL = await initSqlJs().catch(e=>console.error(e))
    const db = new SQL.Database(new Uint8Array(fs.readFileSync(filePath)))
    console.log(db)
    console.log(db.exec)
    const res = db.exec(`select * from comments;`)
    console.log(res)
    return db
})
// db.execの実行結果を返すならOK
ipcMain.handle('getComments', async (event, filePath) => {
    console.log('----- getComments ----- ', filePath)
    const fs = require('fs')
    const SQL = await initSqlJs().catch(e=>console.error(e))
    const db = new SQL.Database(new Uint8Array(fs.readFileSync(filePath)))
    console.log(db)
    const res = db.exec(`select * from comments;`)
    console.log(res)
    return res[0].values
})

/*
ipcMain.handle('open', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        filters: [{ name: 'Documents', extensions: ['txt'] }],
    })
    if (canceled) return { canceled, data: [] }
    const data = filePaths.map((filePath) =>
        fs.readFileSync(filePath, { encoding: 'utf8' })
    )
    return { canceled, data }
})
ipcMain.handle('save', async (event, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        filters: [{ name: 'Documents', extensions: ['txt'] }],
    })
    if (canceled) { return }
    fs.writeFileSync(filePath, data)
})
ipcMain.handle('shell', async (event, command) => {
    const exec = util.promisify(childProcess.exec);
    return await exec(command);
    //let result = await exec(command);
    //document.getElementById('result').value = result.stdout;
})
*/
