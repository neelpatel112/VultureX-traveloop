const fetch = require('node-fetch');

async function run() {
    const email = `test${Date.now()}@test.com`;
    console.log('Testing signup...');
    let res = await fetch('http://localhost:3000/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', email, password: 'password123' })
    });
    console.log('Signup status:', res.status);
    let cookie = res.headers.get('set-cookie');
    console.log('Set-Cookie:', cookie);

    let res2 = await fetch('http://localhost:3000/api/me', {
        headers: { 'Cookie': cookie }
    });
    console.log('/api/me status:', res2.status);
    console.log('/api/me body:', await res2.text());
}

run().catch(console.error);
