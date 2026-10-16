"use client";
import { useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
export function PasswordInput({className='',...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>) {
  const [visible,setVisible]=useState(false),generatedId=useId(),id=props.id||generatedId;
  return <span className="relative mt-2 block">
    <input {...props} id={id} type={visible?'text':'password'} className={`min-h-11 w-full rounded-lg border pl-3 pr-12 font-normal ${className}`}/>
    <button type="button" aria-label={visible?'Ocultar senha':'Mostrar senha'} aria-pressed={visible} aria-controls={id}
      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-300 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-purple-700"
      onMouseDown={e=>e.preventDefault()} onClick={()=>setVisible(value=>!value)}>
      {visible?<EyeOff className="size-5" aria-hidden="true"/>:<Eye className="size-5" aria-hidden="true"/>}
    </button>
  </span>;
}
