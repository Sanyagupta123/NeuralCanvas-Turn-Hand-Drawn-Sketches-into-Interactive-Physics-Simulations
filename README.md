# NeuralCanvas

A lightweight sketch-to-physics studio. Draw circles, blocks, and line segments, adjust their physical properties, then run the Matter.js simulation.

## Run locally

```sh
npm install
npm run dev
```

Use **Select** to choose or move bodies. Choose Circle, Rectangle, or Line and drag on the canvas to create one. The inspector edits position, dimensions, density, friction, restitution, static state, and color. Run simulates the current scene; Reset restores the starter scene. Export scene downloads the current project as JSON.

## Performance notes

The canvas has one `requestAnimationFrame` renderer and Matter.js engine. Physics bodies are stored in refs and never put in React state. The renderer caps device pixel ratio at 2, uses a fixed 60 Hz update threshold with a 33 ms catch-up cap, and enables Matter sleeping for idle bodies. Canvas backing dimensions are only changed when its displayed size changes.

## Scope

This initial frontend foundation includes interactive drawing, selection, moving, property editing, real Matter.js gravity and collisions, reset, undo for scene edits, and JSON export. OpenCV recognition, backend persistence, experiment comparison, and AI scene explanations are not implemented yet.
