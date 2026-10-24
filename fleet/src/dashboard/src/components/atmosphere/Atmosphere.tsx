import { Particles } from './Particles';
import { useSceneRig } from './useSceneRig';

/**
 * The background scene. Rendered once, behind everything, and marked
 * `aria-hidden` — it carries no information, so assistive technology should
 * never encounter it.
 */
export function Atmosphere(): JSX.Element {
  useSceneRig();

  return (
    <div className="scene" aria-hidden="true">
      <div className="field" />
      <div className="aurora">
        <div className="aurora__mass aurora__mass--1" />
        <div className="aurora__mass aurora__mass--2" />
        <div className="aurora__mass aurora__mass--3" />
        <div className="aurora__mass aurora__mass--4" />
      </div>
      <Particles />
      <div className="horizon" />
    </div>
  );
}
