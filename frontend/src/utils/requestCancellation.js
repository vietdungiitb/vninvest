export function isRequestCanceled(err) {
  const code = String(err?.code || '').toUpperCase();
  const name = String(err?.name || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();

  return (
    code === 'ERR_CANCELED'
    || name === 'cancelederror'
    || name === 'aborterror'
    || err?.__CANCEL__ === true
    || message.includes('request aborted')
    || message === 'canceled'
    || message === 'cancelled'
  );
}