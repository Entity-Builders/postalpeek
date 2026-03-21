export function AlbumStackEffect() {
  return (
    <>
      <div
        className='absolute inset-0 bg-white rounded-sm md:rounded-md border border-stone-200/60 shadow-md'
        style={{
          zIndex: 0,
          animation: 'fanRight 0.6s ease-out forwards',
        }}
      />
      <div
        className='absolute inset-0 bg-white rounded-sm md:rounded-md border border-stone-200/40 shadow-sm'
        style={{
          zIndex: 0,
          animation: 'fanLeft 0.6s ease-out 0.1s forwards',
        }}
      />
      <style>{`
        @keyframes fanRight {
          from { transform: rotate(0deg) translate(0, 0); }
          to { transform: rotate(2.5deg) translate(4px, 3px); }
        }
        @keyframes fanLeft {
          from { transform: rotate(0deg) translate(0, 0); }
          to { transform: rotate(-1.5deg) translate(-3px, 5px); }
        }
      `}</style>
    </>
  );
}
