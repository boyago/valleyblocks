import nodemailer from 'nodemailer';
export function mailTransport(env=process.env) {
  if(!env.LABS_SMTP_HOST||!env.LABS_SMTP_USER||!env.LABS_SMTP_PASSWORD)throw Error('Mail not configured');
  const port=Number(env.LABS_SMTP_PORT||465);
  if(![465,587].includes(port))throw Error('Encrypted SMTP port required');
  return nodemailer.createTransport({host:env.LABS_SMTP_HOST,port,secure:port===465,requireTLS:true,
    auth:{user:env.LABS_SMTP_USER,pass:env.LABS_SMTP_PASSWORD},tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false});
}
export async function sendAccountMail({to,subject,text},env=process.env) {
  if(env.LABS_MAIL_OUTBOX){
    // Development only: messages land in a local folder instead of SMTP.
    if(env.NODE_ENV==='production')throw Error('Mail outbox is development-only');
    const {mkdir,appendFile}=await import('node:fs/promises');
    await mkdir(env.LABS_MAIL_OUTBOX,{recursive:true});
    await appendFile(env.LABS_MAIL_OUTBOX+'/outbox.txt',`--- ${new Date().toISOString()} to=${to}
subject: ${subject}
${text}

`);
    return {outbox:true};
  }
  const transporter=mailTransport(env);
  try{return await transporter.sendMail({from:{name:'Vale dos Blocos',address:env.LABS_MAIL_FROM||env.LABS_SMTP_USER},to,subject,text,disableFileAccess:true,disableUrlAccess:true});}
  finally{transporter.close();}
}
