function normalizeSearchValue(value) {
  return (value || '').trim().toLowerCase();
}

function normalizePhoneValue(value) {
  return (value || '').replace(/\s/g, '');
}

export function getContactDisplayName(contact) {
  return contact.displayName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || contact.phone || 'Unnamed contact';
}

export function getContactOwnerLabel(contact) {
  return contact.ownerDisplayName || contact.ownerEmail || contact.ownerUid || '';
}

export function getEmailSuggestions(contacts, value, limit = 5) {
  const query = normalizeSearchValue(value);
  if (query.length < 2) {
    return [];
  }

  return contacts.filter((contact) => {
    const name = getContactDisplayName(contact).toLowerCase();
    const email = (contact.email || '').toLowerCase();
    return Boolean(contact.email) && (name.includes(query) || email.includes(query));
  }).slice(0, limit);
}

export function getPhoneSuggestions(contacts, value, limit = 5) {
  const normalizedValue = normalizePhoneValue(value);
  const query = normalizeSearchValue(value);
  if (normalizedValue.length < 3 && query.length < 2) {
    return [];
  }

  return contacts.filter((contact) => {
    const name = getContactDisplayName(contact).toLowerCase();
    const phone = normalizePhoneValue(contact.phone || '');
    return Boolean(contact.phone) && (
      (normalizedValue.length >= 3 && phone.includes(normalizedValue)) ||
      (query.length >= 2 && name.includes(query))
    );
  }).slice(0, limit);
}

export function filterGroups(groups, value) {
  const query = normalizeSearchValue(value);
  if (!query) {
    return groups;
  }

  return groups.filter((group) => {
    const name = (group.name || '').toLowerCase();
    const owner = getContactOwnerLabel(group).toLowerCase();
    return name.includes(query) || owner.includes(query);
  });
}
