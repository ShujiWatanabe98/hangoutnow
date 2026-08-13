'use client';

import { FormEvent, useState } from 'react';

type Action = { id:string; action:string; reason:string; adminId:string; createdAt:string };
type Report = { id:string; reason:string; details:string|null; status:string; assignedTo:string|null; resolution:string|null; createdAt:string; reporter:{displayName:string}; targetUser:{displayName:string;accountStatus:string}; hangout:{title:string}|null; actions:Action[] };

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://hangoutnow-api.onrender.com';

export default function AdminHome() {
  const [token,setToken]=useState(''); const [adminId,setAdminId]=useState(''); const [reports,setReports]=useState<Report[]>([]); const [error,setError]=useState('');
  const headers={'content-type':'application/json','x-admin-token':token,'x-admin-id':adminId};
  async function load(event?:FormEvent){event?.preventDefault();setError('');const response=await fetch(`${API}/admin/reports`,{headers,cache:'no-store'});if(!response.ok){setError('認証または取得に失敗しました');return}setReports(await response.json() as Report[])}
  async function update(id:string,status:string,resolution?:string){const response=await fetch(`${API}/admin/reports/${id}`,{method:'PATCH',headers,body:JSON.stringify({status,assignedTo:adminId,resolution})});if(!response.ok){setError('状態を更新できませんでした');return}await load()}
  async function act(id:string,action:string){const reason=window.prompt('措置理由を入力してください（監査履歴に保存されます）');if(!reason)return;const response=await fetch(`${API}/admin/reports/${id}/actions`,{method:'POST',headers,body:JSON.stringify({action,reason})});if(!response.ok){setError('措置を記録できませんでした');return}await load()}
  return <main style={{maxWidth:1100,margin:'0 auto',padding:24,fontFamily:'sans-serif',color:'#17221d'}}><h1>Hangout Now 安全管理</h1><form onSubmit={load} style={{display:'flex',gap:8,flexWrap:'wrap'}}><input aria-label="管理トークン" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="管理トークン" required/><input aria-label="担当者ID" value={adminId} onChange={e=>setAdminId(e.target.value)} placeholder="担当者ID" maxLength={100} required/><button>通報を取得</button></form>{error&&<p role="alert" style={{color:'#a32f20'}}>{error}</p>}<section>{reports.map(report=><article key={report.id} style={{border:'1px solid #dce3dd',borderRadius:16,padding:18,marginTop:16}}><h2>{report.reason}・{report.status}</h2><p>通報者: {report.reporter.displayName} ／ 対象: {report.targetUser.displayName}（{report.targetUser.accountStatus}）</p><p>{report.hangout?.title??'Hangout指定なし'} ／ {report.details??'詳細なし'}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>void update(report.id,'REVIEWING')}>調査開始</button><button onClick={()=>{const note=window.prompt('解決内容');if(note)void update(report.id,'RESOLVED',note)}}>対応済み</button><button onClick={()=>void update(report.id,'DISMISSED')}>却下</button><button onClick={()=>void act(report.id,'WARNING')}>警告</button><button onClick={()=>void act(report.id,'SUSPEND')}>一時停止</button><button onClick={()=>void act(report.id,'BAN')}>永久停止</button><button onClick={()=>void act(report.id,'RESTORE')}>復旧</button></div><h3>監査履歴</h3><ul>{report.actions.map(item=><li key={item.id}>{new Date(item.createdAt).toLocaleString('ja-JP')} {item.adminId}: {item.action} — {item.reason}</li>)}</ul></article>)}</section></main>;
}
