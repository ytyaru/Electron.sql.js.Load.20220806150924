window.addEventListener('DOMContentLoaded', async(event) => {
    console.log('DOMContentLoaded!!');
    console.log(window.myApi)
    window.myApi.setup();
    const db = await window.myApi.loadDb(`src/db/mylog.db`);
    console.log(db)
    console.log(db.exec) // main.jsでは関数なのにこちらではundefinedの謎
    //console.log(db.exec(`select * from comments;`)) // Uncaught (in promise) TypeError: db.exec is not a function
    const rows = await window.myApi.getComments(`src/db/mylog.db`)
    console.log(rows)
    const ps = []
    document.getElementById('show').innerHTML = rows.map(row=>`<p>${row[1]}</p>`).join('')
});

