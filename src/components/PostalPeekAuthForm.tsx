import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import type { PostalPeekAccount } from '../hooks/usePostalPeekAccount';

type PostalPeekAuthFormProps = {
  account: PostalPeekAccount;
  emailPlaceholder: string;
  requestLabel: string;
  helperText: string;
  codePlaceholder: string;
  verifyLabel: string;
  resendLabel: string;
};

const renderOAuthMethods = (account: PostalPeekAccount) => {
  const oauthMethods = account.authMethods.filter(
    (method) => method.enabled && method.type === 'oauth' && method.provider,
  );

  if (!oauthMethods.length) return null;

  return (
    <>
      <div className='flex items-center gap-3 my-4'>
        <div className='flex-1 h-px bg-stone-300' />
        <span className='text-stone-400 text-[10px] font-semibold uppercase tracking-wider'>
          or
        </span>
        <div className='flex-1 h-px bg-stone-300' />
      </div>

      <div className='flex flex-col gap-3'>
        {oauthMethods.map((method) => (
          <button
            key={method.id}
            type='button'
            onClick={() =>
              method.provider && void account.signInWithOAuth(method.provider)
            }
            disabled={account.busy}
            className='w-full py-3.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 active:scale-[0.98] text-stone-700 text-sm font-semibold transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50'
          >
            {method.label}
          </button>
        ))}
      </div>
    </>
  );
};

export function PostalPeekAuthForm({
  account,
  emailPlaceholder,
  requestLabel,
  helperText,
  codePlaceholder,
  verifyLabel,
  resendLabel,
}: PostalPeekAuthFormProps) {
  const showCodeStep = account.codeSent;
  const cleanCode = account.code.replace(/\D/g, '').slice(0, 6);

  return (
    <div className='w-full'>
      {account.error ? (
        <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 mb-4 text-center'>
          {account.error}
        </div>
      ) : null}

      {!showCodeStep ? (
        <div className='flex flex-col'>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void account.requestCode();
            }}
            className='flex flex-col gap-3'
          >
            <div className='relative'>
              <Mail className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400' />
              <input
                type='email'
                name='email'
                placeholder={emailPlaceholder}
                value={account.email}
                onChange={(event) => account.setEmail(event.target.value)}
                required
                autoComplete='email'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                className='w-full pl-11 pr-4 py-3.5 rounded-xl border border-stone-300 bg-white/80 text-stone-800 text-base placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/40 focus:border-stone-400 transition-all shadow-sm'
              />
            </div>

            <button
              type='submit'
              disabled={account.busy || !account.email.trim()}
              className='w-full py-3.5 rounded-xl bg-stone-800 hover:bg-stone-900 active:scale-[0.98] disabled:bg-stone-400 disabled:text-white/50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-800/20'
            >
              {account.busy ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                requestLabel
              )}
            </button>

            <p className='text-center text-xs text-stone-400'>{helperText}</p>
          </form>

          {renderOAuthMethods(account)}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void account.verifyCode();
          }}
          className='flex flex-col gap-3'
        >
          <button
            type='button'
            onClick={account.resetCodeRequest}
            className='flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600 transition-colors mb-1 self-start'
          >
            <ArrowLeft className='w-3.5 h-3.5' />
            {account.email}
          </button>

          <input
            type='text'
            inputMode='numeric'
            pattern='[0-9]*'
            maxLength={6}
            placeholder={codePlaceholder}
            value={cleanCode}
            onChange={(event) =>
              account.setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            required
            autoFocus
            className='w-full px-4 py-3.5 rounded-xl border border-stone-300 bg-white/80 text-stone-800 text-center text-xl tracking-[0.5em] font-mono placeholder:text-stone-400 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-stone-400/40 focus:border-stone-400 transition-all shadow-sm'
          />

          <button
            type='submit'
            disabled={account.busy || cleanCode.length < 6}
            className='w-full py-3.5 rounded-xl bg-stone-800 hover:bg-stone-900 active:scale-[0.98] disabled:bg-stone-400 disabled:text-white/50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-800/20'
          >
            {account.busy ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              verifyLabel
            )}
          </button>

          <button
            type='button'
            onClick={() => void account.requestCode()}
            disabled={account.busy}
            className='text-sm text-stone-400 hover:text-stone-600 transition-colors mt-1 text-center'
          >
            {resendLabel}
          </button>
        </form>
      )}
    </div>
  );
}
