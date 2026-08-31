import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore, type YarnPath } from './store'

function TubeYarn({ path }: { path: YarnPath }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const { geometry, material } = useMemo(() => {
    if (path.points.length < 2) {
      return { geometry: new THREE.BufferGeometry(), material: new THREE.MeshStandardMaterial() }
    }

    const curvePoints = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z))
    const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.3)

    const tubularSegments = Math.max(32, path.points.length * 4)
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, 0.12, 8, false)

    const material = new THREE.MeshStandardMaterial({
      color: path.color,
      roughness: 0.45,
      metalness: 0.05,
      emissive: path.color,
      emissiveIntensity: 0.08,
    })

    return { geometry, material }
  }, [path])

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} castShadow receiveShadow />
  )
}

export function YarnPaths() {
  const yarnPaths = useStore((s) => s.yarnPaths)

  return (
    <group>
      {yarnPaths.map((path) => (
        <TubeYarn key={path.id} path={path} />
      ))}
    </group>
  )
}
