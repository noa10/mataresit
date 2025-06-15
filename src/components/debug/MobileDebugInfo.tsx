import { useState, useEffect } from 'react';
import { useMobileViewport } from '@/hooks/use-mobile-viewport';
import { useIsMobile } from '@/hooks/use-mobile';
import { detectBrowserSupport, getBrowserInfo } from '@/utils/browser-compat';

interface MobileDebugInfoProps {
  show?: boolean;
}

export function MobileDebugInfo({ show = process.env.NODE_ENV === 'development' }: MobileDebugInfoProps) {
  const { width, height, isMobile, isLandscape } = useMobileViewport();
  const isMobileHook = useIsMobile();
  const [modalInfo, setModalInfo] = useState<any>(null);
  const [browserSupport] = useState(() => detectBrowserSupport());
  const [browserInfo] = useState(() => getBrowserInfo());

  useEffect(() => {
    const checkModal = () => {
      const modal = document.querySelector('[data-radix-dialog-content]');
      if (modal) {
        const rect = modal.getBoundingClientRect();
        setModalInfo({
          exists: true,
          rect,
          isVisible: rect.width > 0 && rect.height > 0,
          overflowsViewport: rect.right > width || rect.bottom > height,
        });
      } else {
        setModalInfo({ exists: false });
      }
    };

    // Check immediately and on interval
    checkModal();
    const interval = setInterval(checkModal, 1000);

    return () => clearInterval(interval);
  }, [width, height]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] bg-black/90 text-white p-3 rounded-lg text-xs font-mono max-w-sm overflow-y-auto max-h-[80vh]">
      <div className="font-bold mb-2">Cross-Browser Debug Info</div>

      <div className="space-y-1">
        <div className="font-semibold text-yellow-300">Viewport:</div>
        <div>Size: {width}x{height}</div>
        <div>Mobile (viewport): {isMobile ? '✅' : '❌'}</div>
        <div>Mobile (hook): {isMobileHook ? '✅' : '❌'}</div>
        <div>Landscape: {isLandscape ? '✅' : '❌'}</div>

        <div className="border-t border-gray-600 pt-2 mt-2">
          <div className="font-semibold text-blue-300">Browser:</div>
          <div>{browserInfo.name} {browserInfo.version}</div>
        </div>

        <div className="border-t border-gray-600 pt-2 mt-2">
          <div className="font-semibold text-green-300">Feature Support:</div>
          <div>:has() selector: {browserSupport.hasSelector ? '✅' : '❌'}</div>
          <div>100dvh units: {browserSupport.dvhUnits ? '✅' : '❌'}</div>
          <div>Visual viewport: {browserSupport.visualViewport ? '✅' : '❌'}</div>
          <div>matchMedia: {browserSupport.matchMedia ? '✅' : '❌'}</div>
          <div>Touch events: {browserSupport.touchEvents ? '✅' : '❌'}</div>
          <div>CSS Grid: {browserSupport.cssGrid ? '✅' : '❌'}</div>
        </div>
        
        {modalInfo && (
          <>
            <div className="border-t border-gray-600 pt-2 mt-2">
              <div className="font-semibold">Modal Info:</div>
              <div>Exists: {modalInfo.exists ? '✅' : '❌'}</div>
              {modalInfo.exists && (
                <>
                  <div>Visible: {modalInfo.isVisible ? '✅' : '❌'}</div>
                  <div>Overflows: {modalInfo.overflowsViewport ? '❌' : '✅'}</div>
                  {modalInfo.rect && (
                    <>
                      <div>Size: {Math.round(modalInfo.rect.width)}x{Math.round(modalInfo.rect.height)}</div>
                      <div>Pos: {Math.round(modalInfo.rect.left)},{Math.round(modalInfo.rect.top)}</div>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
