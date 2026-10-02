import { onBeforeUnmount, onMounted, ref } from 'vue';

const QUERY = '(max-width: 768px)';

export function useMobile() {
  const isMobile = ref(typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  let media;

  function sync() {
    isMobile.value = media.matches;
  }

  onMounted(() => {
    media = window.matchMedia(QUERY);
    sync();
    media.addEventListener('change', sync);
  });

  onBeforeUnmount(() => {
    media?.removeEventListener('change', sync);
  });

  return { isMobile };
}
