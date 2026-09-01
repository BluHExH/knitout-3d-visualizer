import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
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
  const yarnRadius = useStore((s) => s.yarnRadius)

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

  const base = isTransfer ? 0.048 : isCarrier ? 0.078 : path.held ? 0.125 : 0.105
  const radius = base * yarnRadius

  const { geometry, material } = useMemo(() => {
    if (path.points.length < 2) {
      return { geometry: new THREE.BufferGeometry(), material: new THREE.MeshStandardMaterial() }
    }
    const curvePoints = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
    const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.35)
    const tubularSegments = Math.max(24, path.points.length * 5)
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false)

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
        <planeGeometry args={[20, 0.55]} />
        <meshStandardMaterial color="#1a2332" transparent opacity={0.55} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.08, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 0.55]} />
        <meshStandardMaterial color="#1a2332" transparent opacity={0.55} roughness={0.9} />
      </mesh>
      <Text position={[-9.2, -0.05, -1.5]} fontSize={0.28} color="#6b7280" anchorX="center" anchorY="middle">
        front
      </Text>
      <Text position={[-9.2, -0.05, 1.5]} fontSize={0.28} color="#6b7280" anchorX="center" anchorY="middle">
        back
      </Text>
    </group>
  )
}

function NeedleMarkers() {
  const occupied = useStore((s) => s.occupied)
  const finalState = useStore((s) => s.finalState)
  const gauge = useStore((s) => s.gauge)
  const showNeedleLabels = useStore((s) => s.showNeedleLabels)
  const rack = finalState?.rack ?? 0
  const NS = 1.1 * gauge
  const BG = 3.0

  if (!occupied.length) return null

  const xs = occupied.map((n) => n.n * NS + (n.bed === 'b' ? rack * NS : 0))
  const midX = xs.reduce((a, b) => a + b, 0) / xs.length

  return (
    <group>
      {occupied.map((n) => {
        const x = n.n * NS + (n.bed === 'b' ? rack * NS : 0) - midX
        const z = n.bed === 'f' ? -BG / 2 : BG / 2
        const multi = n.loops > 1
        return (
          <group key={n.key} position={[x, -0.35, z]}>
            <mesh>
              <cylinderGeometry args={[0.06, 0.06, 0.28, 8]} />
              <meshStandardMaterial
                color={multi ? '#fbbf24' : '#6ee7b7'}
                emissive={multi ? '#fbbf24' : '#6ee7b7'}
                emissiveIntensity={0.25}
                roughness={0.4}
              />
            </mesh>
            {showNeedleLabels && (
              <Text
                position={[0, -0.32, 0]}
                fontSize={0.22}
                color={multi ? '#fcd34d' : '#a7f3d0'}
                anchorX="center"
                anchorY="top"
                outlineWidth={0.012}
                outlineColor="#0b0d10"
              >
                {n.key}
                {multi ? `×${n.loops}` : ''}
              </Text>
            )}
          </group>
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
