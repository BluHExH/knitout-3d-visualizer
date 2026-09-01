import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore, type YarnPath } from './store'

function TubeYarn({ path }: { path: YarnPath }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const selectedLine = useStore((s) => s.selectedLine)
  const selectedYarnId = useStore((s) => s.selectedYarnId)
  const selectedOpIndex = useStore((s) => s.selectedOpIndex)
  const showUpToOp = useStore((s) => s.showUpToOp)
  const ghostPast = useStore((s) => s.ghostPast)
  const highlightCurrentOnly = useStore((s) => s.highlightCurrentOnly)
  const selectYarn = useStore((s) => s.selectYarn)

  const op = path.opIndex ?? -1
  const isFuture = showUpToOp !== null && op > showUpToOp
  const isPast = showUpToOp !== null && op < showUpToOp
  const isCurrent = selectedOpIndex !== null && op === selectedOpIndex

  if (isFuture) return null

  const isHighlighted =
    selectedYarnId === path.id ||
    isCurrent ||
    (selectedLine !== null &&
      (path.primaryLine === selectedLine || path.lines.includes(selectedLine)))

  const isTransfer = path.kind === 'transfer'
  const isCarrier = path.kind === 'carrier'
  const isGhost = isPast && ghostPast && !isHighlighted

  const radius = isTransfer ? 0.048 : isCarrier ? 0.078 : path.held ? 0.125 : 0.105

  const { geometry, material } = useMemo(() => {
    if (path.points.length < 2) {
      return { geometry: new THREE.BufferGeometry(), material: new THREE.MeshStandardMaterial() }
    }
    const curvePoints = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
    const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.35)
    const tubularSegments = Math.max(24, path.points.length * 5)
    const radialSegments = 10
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false)

    const material = new THREE.MeshStandardMaterial({
      color: path.color,
      roughness: isTransfer ? 0.35 : 0.72,
      metalness: isTransfer ? 0.35 : 0.0,
      emissive: path.color,
      emissiveIntensity: 0.02,
      transparent: true,
      opacity: isTransfer ? 0.78 : isCarrier ? 0.88 : 0.98,
    })
    return { geometry, material }
  }, [path, radius, isTransfer, isCarrier])

  if (material) {
    if (isGhost) {
      material.opacity = 0.22
      material.emissiveIntensity = 0.01
      material.roughness = 0.85
    } else if (isHighlighted) {
      material.emissiveIntensity = 0.45
      material.opacity = 1
      material.roughness = 0.4
    } else if (highlightCurrentOnly && showUpToOp !== null && !isCurrent) {
      material.opacity = 0.3
      material.emissiveIntensity = 0.01
    } else {
      material.emissiveIntensity = isTransfer ? 0.1 : 0.02
      material.opacity = isTransfer ? 0.78 : isCarrier ? 0.88 : 0.98
    }
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow={!isTransfer && !isGhost}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation()
        selectYarn(path.id, path.primaryLine)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
      scale={isHighlighted ? 1.18 : 1}
    />
  )
}

function BedGuides() {
  return (
    <group>
      <mesh position={[0, -0.08, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 0.5]} />
        <meshStandardMaterial color="#1a2332" transparent opacity={0.55} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.08, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 0.5]} />
        <meshStandardMaterial color="#1a2332" transparent opacity={0.55} roughness={0.9} />
      </mesh>
    </group>
  )
}

function NeedleMarkers() {
  const occupied = useStore((s) => s.occupied)
  const finalState = useStore((s) => s.finalState)
  const rack = finalState?.rack ?? 0
  const NS = 1.1
  const BG = 3.0

  if (!occupied.length) return null

  const xs = occupied.map((n) => n.n * NS + (n.bed === 'b' ? rack * NS : 0))
  const midX = xs.reduce((a, b) => a + b, 0) / xs.length

  return (
    <group>
      {occupied.map((n) => {
        const x = n.n * NS + (n.bed === 'b' ? rack * NS : 0) - midX
        const z = n.bed === 'f' ? -BG / 2 : BG / 2
        return (
          <mesh key={n.key} position={[x, -0.35, z]}>
            <cylinderGeometry args={[0.06, 0.06, 0.25, 8]} />
            <meshStandardMaterial
              color={n.loops > 1 ? '#fbbf24' : '#6ee7b7'}
              emissive={n.loops > 1 ? '#fbbf24' : '#6ee7b7'}
              emissiveIntensity={0.25}
              roughness={0.4}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export function YarnPaths() {
  const yarnPaths = useStore((s) => s.yarnPaths)

  return (
    <group>
      <BedGuides />
      <NeedleMarkers />
      {yarnPaths.map((path) => (
        <TubeYarn key={path.id} path={path} />
      ))}
    </group>
  )
}
