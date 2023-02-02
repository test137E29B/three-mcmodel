import { MeshBasicMaterial } from 'three'

import { MinecraftTexture } from './texture'

export class MinecraftModelMaterial extends MeshBasicMaterial {
  constructor (map: MinecraftTexture = new MinecraftTexture(), tint?: number) {
    super({
      map: map,
      transparent: true,
      alphaTest: 0.5,
      color: tint ?? 0xffffff,
    })
  }
}
