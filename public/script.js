document.body.style.margin   = 0
document.body.style.overflow = `hidden`

const cnv = document.getElementById (`cnv_element`)
cnv.width = innerWidth
cnv.height = innerHeight

const ctx = cnv.getContext (`2d`)

const draw_frame = ms => {
   const t = ms / 1000
   console.log (`page loaded ${ t.toFixed (2)}s ago`)

   ctx.fillStyle = `turquoise`
   ctx.fillRect (0, 0, innerWidth, innerHeight)

   requestAnimationFrame (draw_frame)
}

requestAnimationFrame (draw_frame)

onresize = () => {
   cnv.width = innerWidth
   cnv.height = innerHeight   
}