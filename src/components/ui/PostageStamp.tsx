interface PostageStampProps {
  createdAt: string;
}

export function PostageStamp({ createdAt }: PostageStampProps) {
  return (
    <div className='absolute top-4 right-4 w-12 h-16 md:w-16 md:h-20 border-[3px] border-white/40 border-dashed rounded opacity-70 flex flex-col items-center justify-center -rotate-6 pointer-events-none z-[3]'>
      <span className='text-[10px] md:text-xs font-bold text-white uppercase tracking-widest bg-black/20 px-1 rounded backdrop-blur-sm -rotate-12'>
        POST
      </span>
      <span className='text-[8px] md:text-[10px] text-white/90 font-mono mt-1 drop-shadow-md'>
        {new Date(createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })}
      </span>
    </div>
  );
}
