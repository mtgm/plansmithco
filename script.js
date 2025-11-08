const mv = document.getElementById('mv');
const bar = document.querySelector('.update-bar');
const wrap = document.querySelector('.progress-bar');

mv.addEventListener('progress', (e) => {
  const f = Math.min(1, e.detail.totalProgress || 0);
  bar.style.width = `${f * 100}%`;
  if (f >= 1) wrap.classList.add('hide'); else wrap.classList.remove('hide');
});
