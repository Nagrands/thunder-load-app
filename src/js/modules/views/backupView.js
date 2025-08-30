// src/js/modules/views/backupView.js

export default function renderBackup() {
  // Guard: если вкладка Backup отключена — не инициализируем UI
  const _isBackupDisabled = () => {
    try {
      const raw = localStorage.getItem('backupDisabled');
      if (raw === null) return false; // по умолчанию Backup включён
      return JSON.parse(raw) === true;
    } catch {
      return false;
    }
  };
  if (_isBackupDisabled()) {
    const placeholder = document.createElement('div');
    placeholder.id = 'backup-view';
    placeholder.className = 'backup-view tab-content p-4 space-y-4';
    placeholder.style.display = 'none';
    return placeholder;
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'backup-view';
  wrapper.className = 'backup-view tab-content p-4 space-y-4';

  const container = document.createElement('div');
  container.className = 'backup-center';
  container.innerHTML = `
    <div class="flex flex-col gap-4">
      <h1 class="text-xl">Backup</h1>
      <p class="muted">Create and restore application backups here. (Coming soon)</p>
    </div>
  `;

  wrapper.appendChild(container);
  return wrapper;
}
