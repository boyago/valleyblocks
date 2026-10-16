import { mailTransport } from '../lib/server/mail.mjs';
// This command authenticates SMTP only. It never sends messages or prints secrets.
if(process.argv[2])process.loadEnvFile(process.argv[2]);
let transport;
try{transport=mailTransport();await transport.verify();console.log('SMTP da Hostinger autenticado com TLS. Nenhum e-mail foi enviado.');}
catch(error){console.error('Não foi possível verificar o SMTP:',/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'CONFIGURATION_ERROR');process.exitCode=1;}
finally{transport?.close();}
