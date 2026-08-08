export class EventLog {
  constructor(root) {
    this.list = root.querySelector('#eventLogList');
  }

  render(entries) {
    this.list.innerHTML = '';
    entries.forEach((e) => {
      const li = document.createElement('li');
      li.className = e.level;
      li.innerHTML = `<span class="t">${e.t}</span><span class="lvl">[${e.level}]</span>${e.msg}`;
      this.list.appendChild(li);
    });
  }
}
