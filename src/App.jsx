import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, Grid } from '@react-three/drei'
import {
  Activity, BatteryCharging, Box, ChevronDown, CircuitBoard, Download,
  Gauge, LayoutDashboard, Play, Pause, RotateCcw, Save, Settings, SlidersHorizontal,
  Trash2, Waves, Zap
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import './App.css'

const navItems = [
  ['Overview', LayoutDashboard],
  ['3D Charging Lab', Box],
  ['Coil Configuration', CircuitBoard],
  ['Coupling Analysis', Waves],
  ['Resonance', Activity],
  ['Power Electronics', Zap],
  ['Battery System', BatteryCharging],
  ['Performance', Gauge],
]

function TorusCoil({ position, receiver = false }) {
  const rings = Array.from({ length: 7 }, (_, index) => (
    <mesh key={index} position={[0, index * 0.018, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.58 - index * 0.035, 0.018, 10, 48]} />
      <meshStandardMaterial color={receiver ? '#ffb45c' : '#43d8ff'} emissive={receiver ? '#a95f18' : '#087aa4'} emissiveIntensity={1.2} metalness={0.75} roughness={0.22} />
    </mesh>
  ))
  return <group position={position}>{rings}</group>
}

function FieldLines({ visible, running }) {
  const group = useRef()
  useFrame((state) => {
    if (group.current) group.current.rotation.z = running ? state.clock.elapsedTime * 0.35 : 0
  })
  if (!visible) return null
  return (
    <group ref={group}>
      {[-1.1, -0.55, 0, 0.55, 1.1].map((x, i) => (
        <mesh key={i} position={[x * 0.55, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.58, 0.008, 8, 44, Math.PI]} />
          <meshBasicMaterial color="#42d7ff" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function Vehicle({ gap, lateral, angle, exploded }) {
  const receiverY = 1.02 + gap * 1.5
  return (
    <group position={[lateral * 2.2, 0, 0]} rotation={[0, -0.18, angle * Math.PI / 180]}>
      <mesh position={[0, 0.72 + (exploded ? 0.45 : 0), 0]} castShadow>
        <boxGeometry args={[3.8, 0.58, 1.72]} />
        <meshStandardMaterial color="#1854bd" metalness={0.55} roughness={0.18} />
      </mesh>
      <mesh position={[-0.15, 1.12 + (exploded ? 0.72 : 0), 0]} castShadow>
        <boxGeometry args={[2.25, 0.72, 1.58]} />
        <meshStandardMaterial color="#0c69d7" metalness={0.7} roughness={0.16} />
      </mesh>
      {[-1.18, 1.18].map((x) =>
        [-0.82, 0.82].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.45, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.43, 0.13, 16, 32]} />
            <meshStandardMaterial color="#07101d" metalness={0.25} roughness={0.7} />
          </mesh>
        ))
      )}
      {[-0.88, 0.88].map((z) => (
        <mesh key={z} position={[1.92, 0.75, z]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.32, 0.11, 0.04]} />
          <meshBasicMaterial color="#a8f6ff" toneMapped={false} />
        </mesh>
      ))}
      <TorusCoil position={[0, receiverY + (exploded ? -0.25 : 0), 0]} receiver />
    </group>
  )
}

function ChargingScene({ gap, lateral, angle, running, fieldVisible, exploded, cameraPreset, cameraReset }) {
  const controls = useRef()
  useEffect(() => {
    if (!controls.current) return
    const views = {
      Perspective: [5.2, 3.7, 5.6],
      Top: [0, 8, 0.01],
      Side: [0.1, 2.2, 8],
      Front: [8, 2.3, 0.1],
      Underside: [0, -5, 0.1],
    }
    const position = views[cameraPreset] || views.Perspective
    controls.current.object.position.set(...position)
    controls.current.target.set(0, 0.55, 0)
    controls.current.update()
  }, [cameraPreset, cameraReset])
  return (
    <Canvas shadows camera={{ position: [5.2, 3.7, 5.6], fov: 38 }}>
      <color attach="background" args={['#07111f']} />
      <fog attach="fog" args={['#07111f', 9, 16]} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[4, 8, 5]} intensity={2.4} castShadow />
      <pointLight position={[0, 2, 0]} intensity={15} distance={5} color="#38bdf8" />
      <Grid position={[0, -0.02, 0]} args={[12, 12]} cellSize={0.5} cellThickness={0.5} cellColor="#12344e" sectionSize={2} sectionThickness={1} sectionColor="#1a5575" />
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[12, 0.2, 12]} />
        <meshStandardMaterial color="#101a27" roughness={0.76} />
      </mesh>
      <TorusCoil position={[0, 0.08, 0]} />
      <FieldLines visible={fieldVisible} running={running} />
      <Vehicle gap={gap} lateral={lateral} angle={angle} exploded={exploded} />
      <ContactShadows position={[0, -0.01, 0]} opacity={0.55} scale={9} blur={2} />
      <OrbitControls ref={controls} makeDefault minDistance={3} maxDistance={12} maxPolarAngle={Math.PI * 0.95} />
    </Canvas>
  )
}

const formatNumber = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—'

function PlotChart({ data, layout, style }) {
  const width = 800
  const height = Number.parseInt(style?.height, 10) || 260
  const padding = { top: 28, right: 24, bottom: 48, left: 58 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const points = data.flatMap(trace => trace.x.map((x, index) => ({ x: Number(x), y: Number(trace.y[index]) })))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
  const xMin = points.length ? Math.min(...points.map(point => point.x)) : 0
  const xMax = points.length ? Math.max(...points.map(point => point.x)) : 1
  const yMinRaw = points.length ? Math.min(...points.map(point => point.y)) : 0
  const yMaxRaw = points.length ? Math.max(...points.map(point => point.y)) : 1
  const yPad = (yMaxRaw - yMinRaw || 1) * 0.1
  const yMin = yMinRaw - yPad
  const yMax = yMaxRaw + yPad
  const xScale = value => padding.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth
  const yScale = value => padding.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight
  const ticks = Array.from({ length: 5 }, (_, i) => i / 4)
  return (
    <svg className="plot-chart" viewBox={`0 0 ${width} ${height}`} style={style} role="img"
      aria-label={`${layout?.xaxis?.title || 'X'} by ${layout?.yaxis?.title || 'Y'}`}>
      {ticks.map(tick => {
        const y = padding.top + plotHeight * tick
        const value = yMax - (yMax - yMin) * tick
        return <g key={`y-${tick}`}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#1d3550" /><text x={padding.left - 8} y={y + 4} textAnchor="end" fill="#8096a9" fontSize="10">{formatNumber(value, 0)}</text></g>
      })}
      {ticks.map(tick => {
        const x = padding.left + plotWidth * tick
        const value = xMin + (xMax - xMin) * tick
        return <g key={`x-${tick}`}><line x1={x} x2={x} y1={padding.top} y2={padding.top + plotHeight} stroke="#142b40" /><text x={x} y={height - 26} textAnchor="middle" fill="#8096a9" fontSize="10">{formatNumber(value, 0)}</text></g>
      })}
      {data.map((trace, traceIndex) => {
        const color = trace.line?.color || ['#39c8f4', '#9a7aff', '#45dfa4'][traceIndex % 3]
        const valid = trace.x.map((x, index) => ({ x: Number(x), y: Number(trace.y[index]) }))
          .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
        const path = valid.map((point, index) => `${index ? 'L' : 'M'}${xScale(point.x)},${yScale(point.y)}`).join(' ')
        return <g key={`${trace.name}-${traceIndex}`}>
          <path d={path} fill="none" stroke={color} strokeWidth={trace.line?.width || 2} />
          {trace.mode?.includes('markers') && valid.map((point, index) => <circle key={index} cx={xScale(point.x)} cy={yScale(point.y)} r="3" fill={color}><title>{`${trace.name || 'Series'}: ${point.x.toFixed(2)}, ${point.y.toFixed(2)}`}</title></circle>)}
          <line x1={padding.left + traceIndex * 170} x2={padding.left + 18 + traceIndex * 170} y1="13" y2="13" stroke={color} strokeWidth="2" />
          <text x={padding.left + 24 + traceIndex * 170} y="17" fill="#9bb0c2" fontSize="10">{trace.name || `Series ${traceIndex + 1}`}</text>
        </g>
      })}
      <text x={padding.left + plotWidth / 2} y={height - 5} textAnchor="middle" fill="#91a6bd" fontSize="10">{layout?.xaxis?.title || ''}</text>
      <text transform={`translate(14 ${padding.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill="#91a6bd" fontSize="10">{layout?.yaxis?.title || ''}</text>
    </svg>
  )
}

function Metric({ label, value, accent }) {
  return <div className="module-metric"><span>{label}</span><strong className={accent ? 'cyan' : ''}>{value}</strong></div>
}

function NumberField({ label, value, unit, onChange, min = 0 }) {
  return (
    <label className="number-field"><span>{label}<small>{unit}</small></span>
      <input type="number" min={min} step="any" value={value}
        onChange={event => onChange(Number(event.target.value))} /></label>
  )
}

async function postJson(path, body, signal) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data
}

function ModuleWorkspace({
  active, result, parameters, setParameters, gap, setGap, lateral, setLateral,
  angle, setAngle, frequency, setFrequency, load, setLoad, soc, setSoc,
  frequencyData, scenarios, onSimulate, onReset, onScenariosChanged, error,
}) {
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [scenarioName, setScenarioName] = useState('')
  const [batteryResult, setBatteryResult] = useState(null)
  const [experiment, setExperiment] = useState([])

  const handleResonance = async () => {
    setBusy(true)
    try {
      const data = await postJson('/api/resonance', {
        l1: parameters.l1, l2: parameters.l2, frequency: frequency * 1000,
      })
      setDetail(data)
      setMessage('Capacitors calculated from the selected inductances and drive frequency.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const runAirgapSweep = async () => {
    setBusy(true)
    try {
      const data = await postJson('/api/experiments/airgap', {
        ...parameters, k: parameters.k_ref, frequency: frequency * 1000, load, start: 0.05, end: 0.2,
        points: 16, lateral: Math.abs(lateral) / 100, angle,
      })
      setExperiment(data.points)
      setMessage('Air-gap sweep completed by the circuit model.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const runBatteryStep = async () => {
    setBusy(true)
    try {
      const data = await postJson('/api/battery', {
        soc, capacity_ah: parameters.capacity_ah, charging_power: result?.battery_power || 0,
        nominal_voltage: parameters.battery_voltage, max_voltage: parameters.max_battery_voltage,
        max_current: parameters.max_battery_current, delta_hours: 1,
      })
      setBatteryResult(data)
      setSoc(data.soc)
      setMessage(data.charging_status === 'Charging complete' ? 'Battery cutoff reached.' : 'One simulated charging hour applied.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const saveScenario = async () => {
    if (!scenarioName.trim()) {
      setMessage('Enter a scenario name before saving.')
      return
    }
    setBusy(true)
    try {
      await postJson('/api/scenarios', {
        name: scenarioName.trim(),
        parameters: {
          ...parameters,
          frequency: frequency * 1000,
          load,
          k: result?.coupling ?? 0.25,
          distance: gap / 100,
          lateral: Math.abs(lateral) / 100,
          angle,
        },
      })
      setScenarioName('')
      await onScenariosChanged()
      setMessage('Scenario saved to the local SQLite database.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const removeScenario = async (id) => {
    setBusy(true)
    try {
      const response = await fetch('/api/scenarios', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) throw new Error('Could not delete scenario')
      await onScenariosChanged()
      setMessage('Scenario removed.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const exportUrl = `/api/export/csv?${new URLSearchParams({
    frequency: String(frequency * 1000), load: String(load), l1: String(parameters.l1),
    l2: String(parameters.l2), r1: String(parameters.r1), r2: String(parameters.r2),
    c1: String(parameters.c1), c2: String(parameters.c2), distance: String(gap / 100),
    angle: String(angle),
    v1: String(parameters.v1), k: String(result?.coupling ?? 0.25),
  }).toString()}`
  const chartBase = {
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
    font: { color: '#91a6bd', size: 11 },
    margin: { l: 48, r: 16, t: 28, b: 42 },
    xaxis: { gridcolor: '#1d3550' }, yaxis: { gridcolor: '#1d3550' },
    legend: { orientation: 'h', x: 0, y: 1.15 },
  }

  if (active === '3D Charging Lab') return null

  return (
    <section className="module-workspace">
      <div className="module-intro">
        <div><span className="eyebrow">ENGINEERING WORKSPACE / {active.toUpperCase()}</span><h2>{active}</h2>
          <p>Interactive tools use the same coupled-coil model as the live charging laboratory.</p></div>
        <div className="module-actions">
          <button className="control-button" onClick={onSimulate} disabled={busy}><Activity size={14} /> Recalculate</button>
          <a className="control-button" href={exportUrl}><Download size={14} /> Export CSV</a>
        </div>
      </div>

      {(message || error) && <div className={((message || error).toLowerCase().includes('error') || (message || error).toLowerCase().includes('enter') || (message || error).toLowerCase().includes('could not')) ? 'module-message warning' : 'module-message'}>{message || error}</div>}

      {active === 'Overview' && <>
        <div className="module-metrics">
          <Metric label="AC input power" value={`${formatNumber(result?.pin_ac / 1000)} kW`} />
          <Metric label="Battery output" value={`${formatNumber(result?.battery_power / 1000)} kW`} accent />
          <Metric label="End-to-end efficiency" value={`${formatNumber(result?.total_efficiency)}%`} accent />
          <Metric label="Coupling coefficient" value={formatNumber(result?.coupling, 3)} />
        </div>
        <div className="module-two-col">
          <div className="module-card"><div className="card-title"><div><span>Operating point</span><strong>Live engineering state</strong></div></div>
            <div className="detail-list">
              <div><span>Primary current (RMS)</span><strong>{formatNumber(result?.i1_rms)} A</strong></div>
              <div><span>Secondary current (RMS)</span><strong>{formatNumber(result?.i2_rms)} A</strong></div>
              <div><span>Mutual inductance</span><strong>{formatNumber(result?.m_h * 1e6)} µH</strong></div>
              <div><span>Coil losses</span><strong>{formatNumber(result?.p_coil_loss)} W</strong></div>
              <div><span>Current resonance</span><strong>{formatNumber(result?.fr_primary_hz / 1000)} kHz</strong></div>
            </div>
          </div>
          <div className="module-card"><div className="card-title"><div><span>Performance sweep</span><strong>Frequency vs efficiency</strong></div></div>
            <PlotChart data={[{ x: frequencyData.map(p => p.frequency_khz), y: frequencyData.map(p => p.efficiency), type: 'scatter', mode: 'lines', line: { color: '#39c8f4', width: 2 }, name: 'Efficiency' }]}
              layout={{ ...chartBase, xaxis: { ...chartBase.xaxis, title: 'Frequency (kHz)' }, yaxis: { ...chartBase.yaxis, title: 'Efficiency (%)' } }}
              style={{ width: '100%', height: '270px' }} />
          </div>
        </div>
      </>}

      {active === 'Coil Configuration' && <>
        <div className="module-two-col">
          <div className="module-card"><div className="card-title"><div><span>Editable parameters</span><strong>Series-series coil set</strong></div></div>
            <div className="form-grid">
              <NumberField label="Primary inductance" unit="µH" value={parameters.l1 * 1e6} onChange={v => setParameters(p => ({ ...p, l1: v * 1e-6 }))} />
              <NumberField label="Secondary inductance" unit="µH" value={parameters.l2 * 1e6} onChange={v => setParameters(p => ({ ...p, l2: v * 1e-6 }))} />
              <NumberField label="Primary resistance" unit="Ω" value={parameters.r1} onChange={v => setParameters(p => ({ ...p, r1: v }))} />
              <NumberField label="Secondary resistance" unit="Ω" value={parameters.r2} onChange={v => setParameters(p => ({ ...p, r2: v }))} />
              <NumberField label="Primary capacitor" unit="nF" value={parameters.c1 * 1e9} onChange={v => setParameters(p => ({ ...p, c1: v * 1e-9 }))} />
              <NumberField label="Secondary capacitor" unit="nF" value={parameters.c2 * 1e9} onChange={v => setParameters(p => ({ ...p, c2: v * 1e-9 }))} />
            </div>
            <button className="control-primary module-submit" onClick={onSimulate}><Activity size={14} /> Apply and solve circuit</button>
          </div>
          <div className="module-card"><div className="card-title"><div><span>Model output</span><strong>Coupled-coil results</strong></div></div>
            <div className="module-metrics compact"><Metric label="M mutual" value={`${formatNumber(result?.m_h * 1e6)} µH`} /><Metric label="Primary RMS" value={`${formatNumber(result?.i1_rms)} A`} /><Metric label="Secondary RMS" value={`${formatNumber(result?.i2_rms)} A`} /><Metric label="Coil loss" value={`${formatNumber(result?.p_coil_loss)} W`} /></div>
            <p className="engineering-note">Initial parameter values are illustrative. The backend solves the fundamental-frequency phasor equations; this is not a validated physical coil design.</p>
          </div>
        </div>
      </>}

      {active === 'Coupling Analysis' && <>
        <div className="module-two-col">
          <div className="module-card"><div className="card-title"><div><span>Position sweep</span><strong>Air gap and offset sensitivity</strong></div><button className="control-button" onClick={runAirgapSweep} disabled={busy}>{busy ? 'Calculating…' : 'Run air-gap sweep'}</button></div>
            <div className="form-grid">
              <div className="range-field"><label>Current air gap <strong>{gap} cm</strong></label><input type="range" min="5" max="20" value={gap} onChange={e => setGap(Number(e.target.value))} /></div>
              <div className="range-field"><label>Lateral offset <strong>{lateral} cm</strong></label><input type="range" min="-10" max="10" value={lateral} onChange={e => setLateral(Number(e.target.value))} /></div>
              <div className="range-field"><label>Angular misalignment <strong>{angle}°</strong></label><input type="range" min="0" max="45" value={angle} onChange={e => setAngle(Number(e.target.value))} /></div>
            </div>
            <div className="module-metrics compact"><Metric label="k" value={formatNumber(result?.coupling, 4)} /><Metric label="Mutual inductance" value={`${formatNumber(result?.m_h * 1e6)} µH`} /><Metric label="Received power" value={`${formatNumber(result?.p_secondary / 1000)} kW`} /><Metric label="Efficiency" value={`${formatNumber(result?.total_efficiency)}%`} accent /></div>
          </div>
          <div className="module-card"><div className="card-title"><div><span>Empirical approximation</span><strong>Calculated air-gap response</strong></div></div>
            {experiment.length ? <PlotChart data={[{ x: experiment.map(p => p.distance_cm), y: experiment.map(p => p.efficiency), type: 'scatter', mode: 'lines+markers', name: 'Efficiency', line: { color: '#39c8f4' } }]} layout={{ ...chartBase, xaxis: { ...chartBase.xaxis, title: 'Air gap (cm)' }, yaxis: { ...chartBase.yaxis, title: 'System efficiency (%)' } }} style={{ width: '100%', height: '300px' }} /> :
              <div className="empty-chart"><Waves size={26} /><span>Run the sweep to calculate performance across 5–20 cm.</span></div>}
            <p className="engineering-note">Illustrative coupling approximation only. It is not a numerically solved electromagnetic field or validated coil geometry.</p>
          </div>
        </div>
      </>}

      {active === 'Resonance' && <>
        <div className="module-two-col">
          <div className="module-card"><div className="card-title"><div><span>Resonant tuning</span><strong>Calculate series capacitors</strong></div></div>
            <div className="form-grid">
              <NumberField label="Primary inductance" unit="µH" value={parameters.l1 * 1e6} onChange={v => setParameters(p => ({ ...p, l1: v * 1e-6 }))} />
              <NumberField label="Secondary inductance" unit="µH" value={parameters.l2 * 1e6} onChange={v => setParameters(p => ({ ...p, l2: v * 1e-6 }))} />
              <NumberField label="Target frequency" unit="kHz" value={frequency} onChange={setFrequency} />
            </div>
            <button className="control-primary module-submit" onClick={handleResonance} disabled={busy}><Activity size={14} /> {busy ? 'Solving…' : 'Calculate resonance'}</button>
          </div>
          <div className="module-card"><div className="card-title"><div><span>Resonance calculation</span><strong>Independent primary / secondary values</strong></div></div>
            {detail ? <div className="result-table"><div><span>Primary compensation C₁</span><strong>{formatNumber(detail.c1 * 1e9, 3)} nF</strong></div><div><span>Secondary compensation C₂</span><strong>{formatNumber(detail.c2 * 1e9, 3)} nF</strong></div><div><span>Target frequency</span><strong>{formatNumber(detail.frequency / 1000, 3)} kHz</strong></div></div> : <div className="empty-chart"><Activity size={26} /><span>Set your coil values and calculate the required capacitance.</span></div>}
            <p className="engineering-note">Uses fr = 1 / (2π√LC). Parasitics and component tolerances are not modeled.</p>
          </div>
        </div>
      </>}

      {active === 'Power Electronics' && <>
        <div className="module-two-col">
          <div className="module-card"><div className="card-title"><div><span>Conversion stages</span><strong>Configure modeled efficiencies</strong></div></div>
            {[
              ['AC input / DC link', 'ac_dc_efficiency'],
              ['Secondary rectifier', 'rectifier_efficiency'],
              ['DC-DC battery converter', 'dc_dc_efficiency'],
            ].map(([label, key]) => <div className="range-field" key={key}><label>{label}<strong>{formatNumber(parameters[key] * 100, 1)}%</strong></label><input type="range" min="80" max="100" value={parameters[key] * 100} onChange={e => setParameters(p => ({ ...p, [key]: Number(e.target.value) / 100 }))} /></div>)}
            <button className="control-primary module-submit" onClick={onSimulate}><Activity size={14} /> Recalculate power flow</button>
          </div>
          <div className="module-card"><div className="card-title"><div><span>Power flow (average)</span><strong>Modeled conversion stages</strong></div></div>
            <div className="result-table"><div><span>AC fundamental input</span><strong>{formatNumber(result?.pin_ac)} W</strong></div><div><span>AC-DC stage output</span><strong>{formatNumber(result?.input_dc)} W</strong></div><div><span>Secondary rectifier output</span><strong>{formatNumber(result?.secondary_dc)} W</strong></div><div><span>Battery-side output</span><strong>{formatNumber(result?.battery_power)} W</strong></div><div><span>Combined conversion losses*</span><strong>{formatNumber(result?.converter_loss)} W</strong></div></div>
            <p className="engineering-note">*This total includes coil and converter losses. Simplified stage-efficiency model; inverter switching waveforms are not simulated.</p>
          </div>
        </div>
      </>}

      {active === 'Battery System' && <>
        <div className="module-two-col">
          <div className="module-card"><div className="card-title"><div><span>Battery controls</span><strong>CC/CV limits and charge step</strong></div></div>
            <div className="form-grid">
              <NumberField label="Battery capacity" unit="Ah" value={parameters.capacity_ah} onChange={v => setParameters(p => ({ ...p, capacity_ah: v }))} />
              <NumberField label="Nominal voltage" unit="V" value={parameters.battery_voltage} onChange={v => setParameters(p => ({ ...p, battery_voltage: v }))} />
              <NumberField label="Maximum pack voltage" unit="V" value={parameters.max_battery_voltage} onChange={v => setParameters(p => ({ ...p, max_battery_voltage: v }))} />
              <NumberField label="Maximum charge current" unit="A" value={parameters.max_battery_current} onChange={v => setParameters(p => ({ ...p, max_battery_current: v }))} />
            </div>
            <div className="range-field"><label>Initial/current SOC <strong>{formatNumber(soc, 1)}%</strong></label><input type="range" min="0" max="100" step=".1" value={soc} onChange={e => setSoc(Number(e.target.value))} /></div>
            <button className="control-primary module-submit" onClick={runBatteryStep} disabled={busy}><BatteryCharging size={14} /> {busy ? 'Simulating…' : 'Simulate 1 hour charge'}</button>
          </div>
          <div className="module-card"><div className="card-title"><div><span>Charging model</span><strong>{batteryResult?.charging_status || 'Ready'}</strong></div></div>
            <div className="module-metrics compact"><Metric label="Battery SOC" value={`${formatNumber(soc, 1)}%`} accent /><Metric label="Charge current" value={`${formatNumber(batteryResult?.charging_current ?? Math.min((result?.battery_power || 0) / parameters.battery_voltage, parameters.max_battery_current))} A`} /><Metric label="Battery voltage" value={`${formatNumber(batteryResult?.charging_voltage ?? parameters.battery_voltage)} V`} /><Metric label="Charge power" value={`${formatNumber(batteryResult?.charging_power ?? result?.battery_power)} W`} /></div>
            <div className="battery-progress"><span style={{ width: `${soc}%` }} /></div>
            <p className="engineering-note">SOC change is calculated using I·Δt/(3600·capacity). A simulated one-hour step is not a real-time battery electrochemical model.</p>
          </div>
        </div>
      </>}

      {active === 'Performance' && <>
        <div className="module-card">
          <div className="card-title"><div><span>Calculated data</span><strong>Frequency response, scenario manager and exports</strong></div><a className="control-button" href={exportUrl}><Download size={14} /> Download CSV</a></div>
          <PlotChart data={[
            { x: frequencyData.map(p => p.frequency_khz), y: frequencyData.map(p => p.efficiency), type: 'scatter', mode: 'lines', name: 'System efficiency', line: { color: '#39c8f4', width: 2 } },
          ]} layout={{ ...chartBase, xaxis: { ...chartBase.xaxis, title: 'Frequency (kHz)' }, yaxis: { ...chartBase.yaxis, title: 'System efficiency (%)' } }} style={{ width: '100%', height: '290px' }} />
        </div>
        <div className="module-card scenario-card">
          <div className="card-title"><div><span>Local SQLite scenarios</span><strong>Save and compare operating points</strong></div></div>
          <div className="scenario-save"><input value={scenarioName} maxLength={80} placeholder="Scenario name (e.g. 10 cm nominal)" onChange={e => setScenarioName(e.target.value)} /><button className="control-primary" onClick={saveScenario} disabled={busy}><Save size={14} /> Save current</button></div>
          {scenarios.length ? <div className="scenario-table"><div className="scenario-row scenario-head"><span>Name</span><span>Gap / coupling</span><span>Battery power</span><span>Efficiency</span><span /></div>
            {scenarios.map(s => <div className="scenario-row" key={s.id}><strong>{s.name}</strong><span>{formatNumber((s.result.distance ?? gap / 100) * 100, 0)} cm / {formatNumber(s.result.coupling, 3)}</span><span>{formatNumber(s.result.battery_power / 1000)} kW</span><span>{formatNumber(s.result.total_efficiency)}%</span><button className="delete-button" title={`Delete ${s.name}`} onClick={() => removeScenario(s.id)}><Trash2 size={14} /></button></div>)}
          </div> : <div className="empty-inline">No scenarios saved yet. Save the current simulation to compare it later.</div>}
          {scenarios.length > 1 && <div className="scenario-compare"><strong>Comparison:</strong> {scenarios.map(s => `${s.name}: ${formatNumber(s.result.battery_power / 1000)} kW · ${formatNumber(s.result.total_efficiency)}%`).join('  |  ')}</div>}
        </div>
      </>}

      {active === 'Settings' && <>
        <div className="module-two-col">
          <div className="module-card"><div className="card-title"><div><span>Project defaults</span><strong>Simulation and engineering settings</strong></div></div>
            <div className="form-grid">
              <NumberField label="Input RMS voltage" unit="V" value={parameters.v1} onChange={v => setParameters(p => ({ ...p, v1: v }))} />
              <NumberField label="Drive frequency" unit="kHz" value={frequency} onChange={setFrequency} />
              <NumberField label="Load resistance" unit="Ω" value={load} onChange={setLoad} />
              <NumberField label="Reference coupling" unit="k" value={parameters.k_ref} onChange={v => setParameters(p => ({ ...p, k_ref: Math.min(1, v) }))} />
            </div>
            <button className="control-primary module-submit" onClick={onSimulate}><Activity size={14} /> Apply settings and recalculate</button>
          </div>
          <div className="module-card"><div className="card-title"><div><span>Restore defaults</span><strong>Reset all simulation inputs</strong></div></div>
            <p className="engineering-note">Reset restores the illustrative starting point: 200 µH coils, 0.15 Ω winding resistance, 85 kHz operation, 10 Ω load and a 10 cm air gap.</p>
            <button className="control-button" onClick={onReset}><RotateCcw size={14} /> Restore illustrative defaults</button>
          </div>
        </div>
      </>}
    </section>
  )
}

function App() {
  const [activeNav, setActiveNav] = useState('3D Charging Lab')
  const [running, setRunning] = useState(true)
  const [fieldVisible, setFieldVisible] = useState(true)
  const [exploded, setExploded] = useState(false)
  const [cameraPreset, setCameraPreset] = useState('Perspective')
  const [cameraReset, setCameraReset] = useState(0)
  const [gap, setGap] = useState(10)
  const [lateral, setLateral] = useState(0)
  const [angle, setAngle] = useState(0)
  const [frequency, setFrequency] = useState(85)
  const [load, setLoad] = useState(10)
  const [soc, setSoc] = useState(54)
  const [parameters, setParameters] = useState({
    l1: 200e-6, l2: 200e-6, r1: 0.15, r2: 0.15,
    c1: 17.5e-9, c2: 17.5e-9, v1: 400, k_ref: 0.25,
    ac_dc_efficiency: 0.95, rectifier_efficiency: 0.96, dc_dc_efficiency: 0.94,
    capacity_ah: 75, battery_voltage: 400, max_battery_voltage: 460, max_battery_current: 125,
  })
  const [result, setResult] = useState(null)
  const [frequencyData, setFrequencyData] = useState([])
  const [scenarios, setScenarios] = useState([])
  const [batteryResult, setBatteryResult] = useState(null)
  const [error, setError] = useState('')
  const [simulationRequest, setSimulationRequest] = useState(0)

  useEffect(() => {
    if (!running) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const couplingResponse = await fetch('/api/coupling', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            distance: gap / 100, lateral: Math.abs(lateral) / 100,
            k_ref: parameters.k_ref, l1: parameters.l1, l2: parameters.l2, angle,
          }), signal: controller.signal,
        })
        const couplingData = await couplingResponse.json()
        if (!couplingResponse.ok) throw new Error(couplingData.error || 'Coupling calculation failed')
        const simulation = await postJson('/api/simulate', {
          ...parameters, frequency: frequency * 1000, load, k: couplingData.k,
        }, controller.signal)
        setResult(simulation)
        setError('')
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      }
    }, 180)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [gap, lateral, angle, frequency, load, parameters, simulationRequest, running])

  useEffect(() => {
    if (!running) return undefined
    let active = true
    postJson('/api/experiments/frequency', {
      ...parameters, start: 60000, end: 110000, points: 51, load,
      k: result?.coupling ?? parameters.k_ref,
    }).then(data => { if (active) setFrequencyData(data.points || []) })
      .catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [load, parameters, result?.coupling, running])

  useEffect(() => {
    if (!result) return
    postJson('/api/battery', {
      soc, capacity_ah: parameters.capacity_ah, charging_power: result.battery_power,
      nominal_voltage: parameters.battery_voltage, max_voltage: parameters.max_battery_voltage,
      max_current: parameters.max_battery_current, delta_hours: 0,
    }).then(setBatteryResult).catch(err => setError(err.message))
  }, [result, soc, parameters])

  const loadScenarios = async () => {
    const response = await fetch('/api/scenarios')
    if (!response.ok) throw new Error('Could not load saved scenarios')
    setScenarios(await response.json())
  }
  useEffect(() => {
    let active = true
    fetch('/api/scenarios')
      .then(async response => {
        if (!response.ok) throw new Error('Could not load saved scenarios')
        return response.json()
      })
      .then(data => { if (active) setScenarios(data) })
      .catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [])

  const resetDefaults = () => {
    setGap(10)
    setLateral(0)
    setAngle(0)
    setFrequency(85)
    setLoad(10)
    setSoc(54)
    setParameters({
      l1: 200e-6, l2: 200e-6, r1: 0.15, r2: 0.15,
      c1: 17.5e-9, c2: 17.5e-9, v1: 400, k_ref: 0.25,
      ac_dc_efficiency: 0.95, rectifier_efficiency: 0.96, dc_dc_efficiency: 0.94,
      capacity_ah: 75, battery_voltage: 400, max_battery_voltage: 460, max_battery_current: 125,
    })
  }

  const chartLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#91a6bd', size: 11 },
    margin: { l: 42, r: 14, t: 28, b: 38 },
    legend: { orientation: 'h', x: 0, y: 1.12 },
    xaxis: { gridcolor: '#1d3550', title: 'Frequency (kHz)' },
    yaxis: { gridcolor: '#1d3550', title: 'Efficiency (%)' },
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Zap size={20} /></div>
          <div><strong>WPT</strong><span>EV LAB</span></div>
        </div>
        <div className="nav-label">ENGINEERING MODULES</div>
        <nav>
          {navItems.map(([label, Icon]) => (
            <button className={activeNav === label ? 'active' : ''} onClick={() => setActiveNav(label)} key={label} title={label}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className={activeNav === 'Settings' ? 'settings-link active' : 'settings-link'} onClick={() => setActiveNav('Settings')}><Settings size={17} /><span>Settings</span></button>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <div className="breadcrumbs">WPT EV LAB <ChevronDown size={12} /> <span>{activeNav}</span></div>
            <h1>{activeNav === '3D Charging Lab' ? '3D Charging Laboratory' : activeNav}</h1>
          </div>
          <div className="status-actions">
            <div className="live-status"><span /> Engine Live</div>
            <button className="icon-button" title="Restore defaults" onClick={resetDefaults}><RotateCcw size={18} /></button>
            <div className="avatar">EE</div>
          </div>
        </header>

        <div className={activeNav === '3D Charging Lab' ? 'workspace' : 'workspace module-mode'}>
        {activeNav !== '3D Charging Lab' ? <ModuleWorkspace
          active={activeNav} result={result} parameters={parameters} setParameters={setParameters}
          gap={gap} setGap={setGap} lateral={lateral} setLateral={setLateral}
          angle={angle} setAngle={setAngle}
          frequency={frequency} setFrequency={setFrequency} load={load} setLoad={setLoad}
          soc={soc} setSoc={setSoc} frequencyData={frequencyData} scenarios={scenarios}
          onSimulate={() => { setRunning(true); setSimulationRequest(v => v + 1) }} onReset={resetDefaults}
          onScenariosChanged={loadScenarios} error={error}
        /> : <>
          <section className="viewport-card">
            <div className="viewport-toolbar">
              <div className="toolbar-status">
                <span className={running ? 'pulse' : 'pulse paused'} />
                <strong>{running ? 'Simulation active' : 'Simulation paused'}</strong>
              </div>
              <div className="view-tabs">{['Perspective', 'Top', 'Side', 'Underside'].map(view => <button key={view} className={cameraPreset === view ? 'selected' : ''} onClick={() => setCameraPreset(view)}>{view}</button>)}</div>
            </div>
            <div className="canvas-wrap">
              <ChargingScene gap={gap / 100} lateral={lateral / 100} angle={angle} running={running} fieldVisible={fieldVisible} exploded={exploded} cameraPreset={cameraPreset} cameraReset={cameraReset} />
              {error && <div className="engine-error">{error}</div>}
              <div className="scene-hud">
                <span>COUPLING</span>
                <strong>{formatNumber(result?.coupling, 3)}</strong>
              </div>
            </div>
            <div className="viewport-controls">
              <button className="control-primary" onClick={() => setRunning(v => !v)}>
                {running ? <Pause size={16} /> : <Play size={16} />}
                {running ? 'Pause' : 'Start'}
              </button>
              <button className={fieldVisible ? 'control-button active' : 'control-button'} onClick={() => setFieldVisible(v => !v)}>Magnetic field</button>
              <button className={exploded ? 'control-button active' : 'control-button'} onClick={() => setExploded(v => !v)}>Exploded view</button>
              <button className="control-button" onClick={() => { setGap(10); setLateral(0); setAngle(0); setCameraPreset('Perspective'); setCameraReset(v => v + 1) }}>Reset position</button>
              <div className="units">Air gap <strong>{gap} cm</strong></div>
            </div>
          </section>

          <aside className="properties">
            <div className="panel-heading"><span>Simulation Parameters</span><SlidersHorizontal size={16} /></div>
            <div className="property-section">
              <h3>Coil Position</h3>
              <label><span>Air gap</span><output>{gap} cm</output></label>
              <input type="range" min="5" max="20" value={gap} onChange={e => setGap(Number(e.target.value))} />
              <label><span>Lateral offset</span><output>{lateral} cm</output></label>
              <input type="range" min="-10" max="10" value={lateral} onChange={e => setLateral(Number(e.target.value))} />
            </div>
            <div className="property-section">
              <h3>Electrical Drive</h3>
              <label><span>Operating frequency</span><output>{frequency} kHz</output></label>
              <input type="range" min="60" max="110" value={frequency} onChange={e => setFrequency(Number(e.target.value))} />
              <label><span>Load resistance</span><output>{load} Ω</output></label>
              <input type="range" min="2" max="30" value={load} onChange={e => setLoad(Number(e.target.value))} />
            </div>
            <div className="metrics-grid">
              <div><span>Input power</span><strong>{formatNumber(result?.pin_ac / 1000)} kW</strong></div>
              <div><span>Battery power</span><strong>{formatNumber(result?.battery_power / 1000)} kW</strong></div>
              <div><span>Efficiency</span><strong className="cyan">{formatNumber(result?.total_efficiency)}%</strong></div>
              <div><span>Mutual inductance</span><strong>{formatNumber(result?.m_h * 1e6)} µH</strong></div>
            </div>
          </aside>

          <section className="bottom-panels">
            <div className="chart-card">
              <div className="card-title"><div><span>Frequency sweep</span><strong>Efficiency Analysis</strong></div><span className="model-tag">CALCULATED</span></div>
              <PlotChart
                data={[
                  { x: frequencyData.map(p => p.frequency_khz), y: frequencyData.map(p => p.efficiency), type: 'scatter', mode: 'lines', name: 'System efficiency', line: { color: '#2dc7ff', width: 2 } },
                ]}
                layout={chartLayout}
                style={{ width: '100%', height: '240px' }}
              />
            </div>
            <div className="battery-card">
              <div className="card-title"><div><span>Battery Management</span><strong>Charging Status</strong></div><span className="charging-dot">{batteryResult?.charging_status || 'CALCULATING'}</span></div>
              <div className="soc-layout">
                <div className="soc-ring" style={{ '--soc': `${soc * 3.6}deg` }}>
                  <div><strong>{soc}%</strong><span>SOC</span></div>
                </div>
                <div className="battery-readings">
                  <div><span>Charging current</span><strong>{formatNumber(batteryResult?.charging_current)} A</strong></div>
                  <div><span>Charging voltage</span><strong>{formatNumber(batteryResult?.charging_voltage)} V</strong></div>
                  <div><span>Remaining</span><strong>{formatNumber(batteryResult?.estimated_hours, 1)} h</strong></div>
                </div>
              </div>
            </div>
          </section>
        </>}
        </div>
      </main>
    </div>
  )
}

export default App
