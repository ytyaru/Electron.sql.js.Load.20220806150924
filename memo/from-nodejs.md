# sql.jsをNode.js（Electron）で使う方法

## プロジェクト作成

　[Use from node.js][]を参照。

[Use from node.js]:https://github.com/sql-js/sql.js/#use-from-nodejs

> sql.js is hosted on npm. To install it, you can simply run npm install sql.js. Alternatively, you can simply download sql-wasm.js and sql-wasm.wasm, from the download link below.

> sql.js は npm でホストされています。インストールするには、npm install sql.js を実行するだけです。または、以下のダウンロード リンクから sql-wasm.js と sql-wasm.wasm をダウンロードすることもできます。

　というわけでプロジェクト作成からインストールまでは以下。

```sh
NAME=electron-sqljs-not-load
mkdir $NAME
cd $NAME
npm init -y
npm i electron --save-dev
npm i sql.js
```

　Electron は20.0.1。sql.jsは1.7.0。

package.json
```javascript
{
  "name": "electron-sqljs-not-load",
  "version": "1.0.0",
  "description": "",
  "main": "src/js/main.js",
  "scripts": {
    "start": "electron .",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "electron": "^20.0.1"
  },
  "dependencies": {
    "sql.js": "^1.7.0"
  }
}
```

　以下の順で実行される。

1. package.json
2. main.js
3. preload.js
4. renderer.js

　このファイル順は次のように定義される。

1. package.json
    * `"main": "src/js/main.js"`で指定したファイル`src/js/main.js`を最初に実行する
2. `src/js/main.js`
    * `electron.app.whenReady()`で`new BrowserWindow`し`webPreferences`として`preload: path.join(__dirname, 'preload.js')`のように登録する
3. `src/js/preload.js`
    * ブラウザでは使えないAPIをIPC通信内で実装する
4. `src/js/renderer.js`
    * 3で定義したAPIを呼び出すことでブラウザ外のAPIも使える

src/js/main.js
```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
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
```

* なぜかトップで`const fs = require('fs')`するとエラーになる
* なぜか`ipcMain.handle('...', async (event) => {})`内で`const fs = require('fs')`すると成功する

## slq.js

　読み書きするには以下。

src/js/main.js
```javascript
const fs = require('fs');
const initSqlJs = require('sql-wasm.js');
const filebuffer = fs.readFileSync('test.sqlite');

initSqlJs().then(function(SQL){
  // Load the db
  const db = new SQL.Database(filebuffer);
});
```
```javascript
const fs = require("fs");
// [...] (create the database)
const data = db.export();
const buffer = Buffer.from(data);
fs.writeFileSync("filename.sqlite", buffer);
```

　だが、実際やってみると動作しなかった。

# やってみた

　最初のライブラリをロードする時点でつまづいた。

```javascript
const initSqlJs = require('sql-wasm.js');
```
```sh
Error: module not found: sql-wasm.js
```

　え、`npm install sql.js を実行するだけ`って言ったやん。

　一応その名前でインストールを試してみる。存在しないってさ。

```sh
npm i sql-wasm.js
```
```sh
npm ERR! code E404
npm ERR! 404 Not Found - GET https://registry.npmjs.org/sql-wasm.js - Not found
npm ERR! 404 
npm ERR! 404  'sql-wasm.js@*' is not in this registry.
npm ERR! 404 
npm ERR! 404 Note that you can also install from a
npm ERR! 404 tarball, folder, http url, or git url.

npm ERR! A complete log of this run can be found in:
npm ERR!     /home/pi/.npm/_logs/2022-08-06T03_58_03_955Z-debug-0.log
```

　仕方ないので`sql-wasm.js`を`sql.js`に変更した。たぶんミスだろう。またはバージョン差異によるドキュメント更新忘れか。

src/js/main.js
```javascript
const fs = require('fs');
const initSqlJs = require('sql.js');
const filebuffer = fs.readFileSync('test.sqlite');

initSqlJs().then(function(SQL){
  const db = new SQL.Database(filebuffer);
});
```

　なぜかトップレベルで`const fs = require('fs')`するとエラーになって怒られた。IPC定義内でやると成功した。

　また、なぜか以下のように`db`を渡すと、渡した先では`exec`メソッドが存在せずアクセスできなかった。`return`する前はアクセスできたのに。

src/js/main.js
```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
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
```

　上記をブラウザのJavaScript側で呼び出せるようにする。

src/js/preload.js
```javascript
const {remote,contextBridge,ipcRenderer} =  require('electron');
contextBridge.exposeInMainWorld('myApi', {
    loadDb:async(filePath)=>await ipcRenderer.invoke('loadDb', filePath),
})
```

　上記`loadDb`APIを呼び出す。

src/js/renderer.js
```javascript
window.addEventListener('DOMContentLoaded', async(event) => {
    const db = await window.myApi.loadDb(`src/db/mylog.db`);
    console.log(db)
    console.log(db.exec) // main.jsでは関数なのにこちらではundefinedの謎
    //console.log(db.exec(`select * from comments;`)) // Uncaught (in promise) TypeError: db.exec is not a function
});
```

　`new SQL.Database`の戻り値はダメだが、`db.exec`の結果ならreturn後でも参照できるらしい。

src/js/main.js
```javascript
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
```

src/js/preload.js
```javascript
contextBridge.exposeInMainWorld('myApi', {
    getComments:async(filePath)=>await ipcRenderer.invoke('getComments', filePath),
})
```

src/js/renderer.js
```javascript
console.log(await window.myApi.getComments(`src/db/mylog.db`))
```

