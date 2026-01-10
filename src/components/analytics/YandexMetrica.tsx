'use client';

import { useSyncExternalStore } from 'react';
import Script from 'next/script';
import { useConsentStore } from '@/stores/consentStore';
import { YM_COUNTER_ID } from '@/lib/analytics/yandexMetrica';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function YandexMetrica() {
  const { analyticsConsent } = useConsentStore();
  const isMounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Don't render until mounted (prevents hydration mismatch)
  if (!isMounted) return null;

  // Only load if consent is given and counter ID is configured
  if (!analyticsConsent || !YM_COUNTER_ID) {
    return null;
  }

  return (
    <>
      <Script
        id="yandex-metrica"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

            ym(${YM_COUNTER_ID}, 'init', {
              clickmap: true,
              trackLinks: true,
              accurateTrackBounce: true,
              webvisor: true,
              trackHash: true
            });
          `,
        }}
      />
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${YM_COUNTER_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
