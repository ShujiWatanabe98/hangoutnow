const form=document.querySelector('#delete-form');
const status=document.querySelector('#status');
const complete=document.querySelector('#complete');
const apiUrl=globalThis.HANGOUT_NOW_CONFIG?.apiUrl||'http://localhost:3000';

form.addEventListener('submit',async(event)=>{
  event.preventDefault();
  const button=form.querySelector('button');
  const email=form.email.value.trim().toLowerCase();
  status.className='status';
  status.textContent='本人確認中…';
  button.disabled=true;
  try{
    if(email.endsWith('@hangoutnow.example'))throw new Error('共有デモアカウントは削除できません。');
    const login=await fetch(`${apiUrl}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:form.password.value})});
    const session=await login.json().catch(()=>null);
    if(!login.ok)throw new Error('メールアドレスまたはパスワードを確認してください。');
    const deletion=await fetch(`${apiUrl}/users/me`,{method:'DELETE',headers:{authorization:`Bearer ${session.accessToken}`}});
    if(!deletion.ok){const body=await deletion.json().catch(()=>null);throw new Error(body?.message||'アカウントを削除できませんでした。');}
    form.classList.add('hidden');
    complete.classList.remove('hidden');
  }catch(error){status.className='status error';status.textContent=error.message;button.disabled=false;}
});
