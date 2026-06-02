import { Suspense, lazy } from "react";
const Spline = lazy(() => import("@splinetool/react-spline"));

export function SplineScene({ scene, className }) {
  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-g-green border-t-transparent animate-spin" />
      </div>
    }>
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}
