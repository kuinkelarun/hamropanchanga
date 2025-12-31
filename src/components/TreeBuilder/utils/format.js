// Utilities for consistent member display in the integrated Tree Builder

export function displayMemberName(member) {
  if (!member) return 'Unnamed';
  const name = (member.name || '').trim() || 'Unnamed';
  const nick = (member.nickname || '').trim();
  return nick ? `${name} (${nick})` : name;
}
