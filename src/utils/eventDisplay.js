// Preeti handling removed. Return stored Unicode title/description directly.
export const chooseEventTitle = (event) => {
  if (!event) return '';
  return (event.title || event.name || '')
};

export const chooseEventDescription = (event) => {
  if (!event) return '';
  return (event.description || '')
};

export default { chooseEventTitle, chooseEventDescription };
