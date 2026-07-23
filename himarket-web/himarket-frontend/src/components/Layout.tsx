import { Skeleton } from 'antd';

import { Header } from './Header';
import bgImage from '../assets/bg.png';

import type { ReactNode } from 'react';

const SOFT_BACKGROUND_IMAGE =
  'linear-gradient(145deg, rgba(226, 222, 246, 0.58) 0%, rgba(248, 248, 251, 0) 38%), linear-gradient(325deg, rgba(226, 236, 244, 0.55) 0%, rgba(248, 248, 251, 0) 42%), linear-gradient(180deg, #F7F6FB 0%, #FAFAFC 48%, #F6F7FA 100%)';

const AMBIENT_BACKGROUND_IMAGE = 'linear-gradient(180deg, #F7F7FB 0%, #FAFAFC 48%, #F6F7FA 100%)';

const CHAT_LAVENDER_FLOW =
  'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(216, 211, 243, 0.08) 18%, rgba(202, 196, 237, 0.3) 50%, rgba(229, 226, 247, 0.1) 76%, rgba(255, 255, 255, 0) 100%)';

const CHAT_BLUE_FLOW =
  'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(220, 235, 244, 0.08) 20%, rgba(199, 222, 238, 0.27) 52%, rgba(229, 240, 247, 0.09) 76%, rgba(255, 255, 255, 0) 100%)';

const MARKET_LAVENDER_FLOW =
  'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(216, 211, 243, 0.1) 18%, rgba(198, 192, 236, 0.38) 48%, rgba(227, 224, 247, 0.14) 74%, rgba(255, 255, 255, 0) 100%)';

const MARKET_BLUE_FLOW =
  'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(220, 235, 244, 0.1) 20%, rgba(195, 220, 237, 0.34) 52%, rgba(226, 239, 247, 0.12) 76%, rgba(255, 255, 255, 0) 100%)';

interface LayoutProps {
  children: ReactNode;
  className?: string;
  loading?: boolean;
  backgroundVariant?: 'default' | 'soft' | 'chat' | 'market';
}

export function Layout({
  backgroundVariant = 'default',
  children,
  className = '',
  loading = false,
}: LayoutProps) {
  const isChatBackground = backgroundVariant === 'chat';
  const isMarketBackground = backgroundVariant === 'market';
  const isAnimatedBackground = isChatBackground || isMarketBackground;
  const hasCustomBackground = backgroundVariant !== 'default';
  const hasBackgroundImage = backgroundVariant === 'default';

  return (
    <div
      className={`flex min-h-screen flex-col overflow-x-clip ${className}`}
      style={
        hasCustomBackground
          ? {
              backgroundAttachment: 'fixed',
              backgroundImage: isAnimatedBackground
                ? AMBIENT_BACKGROUND_IMAGE
                : SOFT_BACKGROUND_IMAGE,
            }
          : undefined
      }
    >
      {isAnimatedBackground && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
          <div
            className={`absolute -top-[54vh] h-[195vh] ${
              isMarketBackground
                ? 'market-canvas-lavender -left-[34vw] w-[92vw]'
                : 'chat-canvas-lavender -left-[36vw] w-[96vw]'
            }`}
            style={{
              backgroundImage: isMarketBackground ? MARKET_LAVENDER_FLOW : CHAT_LAVENDER_FLOW,
            }}
          />
          <div
            className={`absolute -top-[40vh] h-[190vh] ${
              isMarketBackground
                ? 'market-canvas-blue -right-[38vw] w-[90vw]'
                : 'chat-canvas-blue -right-[40vw] w-[94vw]'
            }`}
            style={{ backgroundImage: isMarketBackground ? MARKET_BLUE_FLOW : CHAT_BLUE_FLOW }}
          />
        </div>
      )}
      {hasBackgroundImage && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[1] h-full min-h-screen w-full"
          style={{
            backgroundAttachment: 'fixed',
            backgroundImage: `url(${bgImage})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
          }}
        />
      )}
      {hasBackgroundImage && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[2] h-full min-h-screen w-full"
          style={{ backdropFilter: 'blur(204px)' }}
        />
      )}
      <Header />
      <div className="flex-1 min-h-0 relative z-10">
        <main className="h-full">
          <div className="mx-auto h-full w-full px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="space-y-8 py-8">
                {/* 页面标题骨架屏 */}
                <div className="text-center mb-8">
                  <Skeleton.Input
                    active
                    size="large"
                    style={{ height: 48, margin: '0 auto 16px', width: 300 }}
                  />
                  <Skeleton.Input
                    active
                    size="small"
                    style={{ height: 24, margin: '0 auto', width: '80%' }}
                  />
                </div>

                {/* 搜索框骨架屏 */}
                <div className="flex justify-center mb-8">
                  <div className="relative w-full max-w-2xl">
                    <Skeleton.Input active size="large" style={{ height: 40, width: '100%' }} />
                  </div>
                </div>

                {/* 子标题骨架屏 */}
                <div className="mb-6">
                  <Skeleton.Input active size="small" style={{ height: 32, width: 200 }} />
                </div>

                {/* 内容区域骨架屏 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div className="h-full rounded-lg shadow-lg bg-white p-4" key={index}>
                      <div className="flex items-start space-x-4">
                        <Skeleton.Avatar active size={48} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <Skeleton.Input active size="small" style={{ width: 120 }} />
                            <Skeleton.Input active size="small" style={{ width: 60 }} />
                          </div>
                          <Skeleton.Input
                            active
                            size="small"
                            style={{ marginBottom: 8, width: 80 }}
                          />
                          <Skeleton.Input
                            active
                            size="small"
                            style={{ marginBottom: 12, width: '100%' }}
                          />
                          <Skeleton.Input
                            active
                            size="small"
                            style={{ marginBottom: 12, width: '100%' }}
                          />
                          <div className="flex items-center justify-between">
                            <Skeleton.Input active size="small" style={{ width: 60 }} />
                            <Skeleton.Input active size="small" style={{ width: 80 }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
        {/* <Footer /> */}
      </div>
    </div>
  );
}
