import { useCallback, useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import { Circle, Eraser, Minus, MousePointer2, Pause, Play, Plus, RotateCcw, Square, Trash2, Undo2 } from 'lucide-react'

type Tool = 'select' | 'circle' | 'rectangle' | 'line'
type SceneObject = { id: string; kind: 'circle' | 'rectangle' | 'line'; x: number; y: number; width: number; height: number; radius?: number; color: string; density: number; friction: number; restitution: number; isStatic: boolean }
const colors = ['#61d9fa', '#9b8cff', '#ffb86b', '#69e6ad']
const initial: SceneObject[] = [
  { id: 'ground', kind: 'rectangle', x: 440, y: 570, width: 780, height: 24, color: '#344155', density: .001, friction: .7, restitution: .1, isStatic: true },
  { id: 'ball', kind: 'circle', x: 270, y: 170, width: 48, height: 48, radius: 24, color: colors[0], density: .001, friction: .15, restitution: .72, isStatic: false },
  { id: 'ramp', kind: 'rectangle', x: 600, y: 450, width: 300, height: 18, color: colors[1], density: .001, friction: .8, restitution: .05, isStatic: true },
]

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<Matter.World | null>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const bodiesRef = useRef(new Map<string, Matter.Body>())
  const objectsRef = useRef<SceneObject[]>(initial)
  const runningRef = useRef(false)
  const frameRef = useRef(0)
  const lastRef = useRef(0)
  const [objects, setObjects] = useState(initial)
  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState('ball')
  const [running, setRunning] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [gravity, setGravity] = useState(1)
  const selectedRef = useRef(selected)
  const zoomRef = useRef(zoom)
  const gravityRef = useRef(gravity)
  const [draft, setDraft] = useState<{x:number;y:number}|null>(null)
  const [history, setHistory] = useState<SceneObject[][]>([])
  objectsRef.current = objects
  runningRef.current = running
  selectedRef.current = selected
  zoomRef.current = zoom
  gravityRef.current = gravity

  const syncObjects = useCallback((next: SceneObject[]) => { setObjects(next); objectsRef.current = next }, [])
  const buildWorld = useCallback(() => {
    if (!worldRef.current) return
    Matter.Composite.clear(worldRef.current, false)
    bodiesRef.current.clear()
    objectsRef.current.forEach(o => {
      const body = o.kind === 'circle'
        ? Matter.Bodies.circle(o.x, o.y, o.radius ?? o.width / 2, { isStatic: o.isStatic, density: o.density, friction: o.friction, restitution: o.restitution, label: o.id })
        : Matter.Bodies.rectangle(o.x, o.y, o.width, o.height, { isStatic: o.isStatic, density: o.density, friction: o.friction, restitution: o.restitution, angle: o.kind === 'line' ? Math.atan2(o.height, o.width) : 0, label: o.id })
      Matter.Composite.add(worldRef.current!, body); bodiesRef.current.set(o.id, body)
    })
  }, [])

  useEffect(() => {
    const engine = Matter.Engine.create({ enableSleeping: true })
    engine.gravity.y = gravityRef.current
    engine.positionIterations = 6; engine.velocityIterations = 4
    engineRef.current = engine; worldRef.current = engine.world
    buildWorld()
    const render = (time: number) => {
      const canvas = canvasRef.current
      if (!canvas) { frameRef.current = requestAnimationFrame(render); return }
      const ctx = canvas.getContext('2d', { alpha: false })!
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) { canvas.width = rect.width * ratio; canvas.height = rect.height * ratio }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.fillStyle = '#10141d'; ctx.fillRect(0, 0, rect.width, rect.height)
      const scale = zoomRef.current / 100
      ctx.save(); ctx.translate(rect.width / 2, rect.height / 2); ctx.scale(scale, scale); ctx.translate(-440, -320)
      ctx.strokeStyle = 'rgba(132,155,187,.10)'; ctx.lineWidth = 1 / scale
      for (let x = 0; x <= 880; x += 32) { ctx.beginPath(); ctx.moveTo(x,0);ctx.lineTo(x,640);ctx.stroke() }
      for (let y = 0; y <= 640; y += 32) { ctx.beginPath(); ctx.moveTo(0,y);ctx.lineTo(880,y);ctx.stroke() }
      if (runningRef.current && time - lastRef.current >= 1000 / 60) { Matter.Engine.update(engine, Math.min(time - (lastRef.current || time), 33)); lastRef.current = time }
      for (const obj of objectsRef.current) {
        const body = bodiesRef.current.get(obj.id); if (!body) continue
        const vertices = body.vertices
        ctx.beginPath(); ctx.moveTo(vertices[0].x, vertices[0].y); for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y); ctx.closePath()
        ctx.fillStyle = obj.color; ctx.fill()
        ctx.strokeStyle = selectedRef.current === obj.id ? '#eef9ff' : 'rgba(255,255,255,.2)'; ctx.lineWidth = (selectedRef.current === obj.id ? 2 : 1) / scale; ctx.stroke()
        if (selectedRef.current === obj.id) { ctx.beginPath(); ctx.arc(body.position.x, body.position.y, 4 / scale, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill() }
      }
      ctx.restore(); frameRef.current = requestAnimationFrame(render)
    }
    frameRef.current = requestAnimationFrame(render)
    return () => { cancelAnimationFrame(frameRef.current); Matter.Engine.clear(engine) }
  }, [buildWorld])

  useEffect(() => { if (engineRef.current) engineRef.current.gravity.y = gravity }, [gravity])

  const locate = (e: React.PointerEvent<HTMLCanvasElement>) => { const rect=e.currentTarget.getBoundingClientRect(); const s=zoomRef.current/100; return {x:(e.clientX-rect.left-rect.width/2)/s+440,y:(e.clientY-rect.top-rect.height/2)/s+320} }
  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); const p=locate(e)
    if (tool === 'select') { const hits=[...objects].reverse().find(o=>{const b=bodiesRef.current.get(o.id);return b&&Matter.Bounds.contains(b.bounds,p)}); setSelected(hits?.id ?? ''); if(hits&&!hits.isStatic){ const b=bodiesRef.current.get(hits.id)!; Matter.Body.setStatic(b,true); (e.currentTarget as HTMLCanvasElement).dataset.drag=hits.id } }
    else setDraft(p)
  }
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => { const id=e.currentTarget.dataset.drag; if(id){const b=bodiesRef.current.get(id);if(b)Matter.Body.setPosition(b,locate(e));return} }
  const pointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => { const c=e.currentTarget; const id=c.dataset.drag; if(id){const b=bodiesRef.current.get(id);const o=objectsRef.current.find(x=>x.id===id);if(b&&o){Matter.Body.setStatic(b,o.isStatic);syncObjects(objectsRef.current.map(x=>x.id===id?{...x,x:b.position.x,y:b.position.y}:x))}delete c.dataset.drag}
    if(!draft)return;const end=locate(e),dx=end.x-draft.x,dy=end.y-draft.y; if(Math.hypot(dx,dy)<8){setDraft(null);return}
    const kind=tool==='circle'?'circle':tool==='line'?'line':'rectangle'; const obj:SceneObject={id:crypto.randomUUID(),kind,x:(draft.x+end.x)/2,y:(draft.y+end.y)/2,width:Math.max(14,Math.abs(dx)),height:Math.max(14,Math.abs(dy)),radius:Math.max(8,Math.min(Math.abs(dx),Math.abs(dy))/2),color:colors[objectsRef.current.length%colors.length],density:.001,friction:.25,restitution:.25,isStatic:kind==='line'}
    setHistory(h=>[...h,objectsRef.current]); const next=[...objectsRef.current,obj]; syncObjects(next); setSelected(obj.id); setDraft(null); requestAnimationFrame(buildWorld)
  }
  const update = (key:keyof SceneObject,value:number|boolean|string) => { const next=objectsRef.current.map(o=>o.id===selected?{...o,[key]:value}:o); syncObjects(next); const b=bodiesRef.current.get(selected);const o=next.find(x=>x.id===selected);if(b&&o){if(key==='x'||key==='y')Matter.Body.setPosition(b,{x:o.x,y:o.y});else if(key==='isStatic')Matter.Body.setStatic(b,Boolean(value));else if(key==='width'||key==='height'||key==='radius'){buildWorld()}else {b.friction=o.friction;b.restitution=o.restitution;Matter.Body.setDensity(b,o.density)}} }
  const toggleRun=()=>{const value=!running; setRunning(value);lastRef.current=0}
  const reset=()=>{setRunning(false);setObjects(o=>o.map(x=>{const original=initial.find(y=>y.id===x.id);return original?{...original}:x}));requestAnimationFrame(buildWorld)}
  const erase=()=>{if(!selected)return;setHistory(h=>[...h,objectsRef.current]);syncObjects(objectsRef.current.filter(o=>o.id!==selected));setSelected('');requestAnimationFrame(buildWorld)}
  const undo=()=>{const prev=history[history.length-1];if(!prev)return;setHistory(h=>h.slice(0,-1));syncObjects(prev);setSelected('');requestAnimationFrame(buildWorld)}
  const selectedObject=objects.find(o=>o.id===selected)
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">N</div><span>NEURAL<span className="brand-light">CANVAS</span></span><span className="divider"/><span className="project-name">Untitled experiment <span className="saved">Saved</span></span></div><div className="top-actions"><button className="quiet" onClick={undo} title="Undo"><Undo2 size={16}/></button><button className="quiet" onClick={()=>{setHistory(h=>[...h,objects]);syncObjects(initial.map(x=>({...x,id:crypto.randomUUID()})));setSelected('')}} title="Clear scene"><Trash2 size={16}/></button><button className="save" onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({version:1,objects,gravity})],{type:'application/json'}));a.download='neuralcanvas-project.json';a.click();URL.revokeObjectURL(a.href)}}>Export scene</button></div></header>
    <div className="workspace"><aside className="left-panel"><div className="panel-label">TOOLS</div><div className="tool-list">
      {([['select','Select',MousePointer2],['circle','Circle',Circle],['rectangle','Rectangle',Square],['line','Line',Minus]] as const).map(([id,label,Icon])=><button key={id} className={`tool-button ${tool===id?'active':''}`} onClick={()=>setTool(id)} title={label}><Icon size={18}/><span>{label}</span></button>)}
      <button className="tool-button" onClick={erase} title="Delete selected"><Eraser size={18}/><span>Erase</span></button>
    </div><div className="panel-label library-label">SCENE OBJECTS <span>{objects.length}</span></div><div className="object-list">{objects.map(o=><button key={o.id} onClick={()=>{setSelected(o.id);setTool('select')}} className={`object-row ${selected===o.id?'chosen':''}`}><span className="object-dot" style={{background:o.color}}/><span>{o.id==='ground'?'Ground':o.id==='ramp'?'Ramp':o.kind==='circle'?'Ball':o.kind==='line'?'Line':'Block'}</span><span className="object-type">{o.isStatic?'STATIC':o.kind.toUpperCase()}</span></button>)}</div><div className="left-foot"><span className="status-dot"/>All systems ready</div></aside>
    <section className="stage"><div className="stage-toolbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Scene 01</strong></div><div className="stage-tools"><button onClick={()=>setZoom(z=>Math.max(60,z-10))}><Minus size={14}/></button><span>{zoom}%</span><button onClick={()=>setZoom(z=>Math.min(140,z+10))}><Plus size={14}/></button><span className="toolbar-sep"/><button onClick={()=>setZoom(100)}><MousePointer2 size={15}/></button></div></div><div className="canvas-wrap"><canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="Physics scene canvas"/><div className="canvas-coord">WORLD SPACE <span>880 × 640</span></div>{draft&&<div className="draw-hint">Drag to create · Esc to cancel</div>}</div><footer className="sim-bar"><div className="sim-controls"><button className={`play ${running?'playing':''}`} onClick={toggleRun}>{running?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}{running?'Pause':'Run simulation'}</button><button className="icon-control" onClick={reset} title="Reset simulation"><RotateCcw size={16}/></button><span className={`sim-status ${running?'live':''}`}><i/>{running?'SIMULATING':'READY'}</span></div><div className="sim-settings"><label>GRAVITY <input type="range" min="0" max="2" step="0.1" value={gravity} onChange={e=>setGravity(+e.target.value)}/><span>{gravity.toFixed(1)}g</span></label><span className="fps">60 <small>FPS</small></span></div></footer></section>
    <aside className="right-panel"><div className="right-head"><div><span className="panel-label">INSPECTOR</span><h2>{selectedObject?selectedObject.id==='ball'?'Ball':selectedObject.id==='ramp'?'Ramp':selectedObject.id==='ground'?'Ground':'Object': 'Scene settings'}</h2></div><span className="inspector-icon"><MousePointer2 size={17}/></span></div>{selectedObject?<><div className="property-section"><div className="section-title">TRANSFORM</div><div className="field-grid"><label>X position<input type="number" value={Math.round(selectedObject.x)} onChange={e=>update('x',+e.target.value)}/></label><label>Y position<input type="number" value={Math.round(selectedObject.y)} onChange={e=>update('y',+e.target.value)}/></label><label>Width<input type="number" min="1" value={Math.round(selectedObject.width)} onChange={e=>update('width',+e.target.value)}/></label><label>Height<input type="number" min="1" value={Math.round(selectedObject.height)} onChange={e=>update('height',+e.target.value)}/></label></div></div><div className="property-section"><div className="section-title">PHYSICS</div><label className="slider-field">Density <span>{selectedObject.density.toFixed(3)}</span><input type="range" min=".0002" max=".006" step=".0002" value={selectedObject.density} onChange={e=>update('density',+e.target.value)}/></label><label className="slider-field">Friction <span>{selectedObject.friction.toFixed(2)}</span><input type="range" min="0" max="1" step=".01" value={selectedObject.friction} onChange={e=>update('friction',+e.target.value)}/></label><label className="slider-field">Restitution <span>{selectedObject.restitution.toFixed(2)}</span><input type="range" min="0" max="1" step=".01" value={selectedObject.restitution} onChange={e=>update('restitution',+e.target.value)}/></label><div className="toggle-row"><span>Static body</span><button className={`toggle ${selectedObject.isStatic?'on':''}`} onClick={()=>update('isStatic',!selectedObject.isStatic)} aria-label="Toggle static body"><i/></button></div></div><div className="property-section color-section"><div className="section-title">APPEARANCE</div><div className="swatches">{colors.map(c=><button key={c} style={{background:c}} className={selectedObject.color===c?'swatch chosen':''} onClick={()=>update('color',c)} aria-label={`Set color ${c}`}/>)}</div></div><button className="delete-object" onClick={erase}><Trash2 size={15}/> Delete object</button></>:<div className="empty-inspector"><div className="empty-icon"><MousePointer2 size={20}/></div><strong>Select an object</strong><span>Choose an object on the canvas to edit its properties.</span><div className="scene-stat"><span>Objects in scene</span><strong>{objects.length}</strong></div><div className="scene-stat"><span>Gravity</span><strong>{gravity.toFixed(1)}g</strong></div></div>}</aside></div>
  </main>
}
