let previewSource = null
let programSource = null

const feeds = document.querySelectorAll(".cam-feed")
const takeBtn = document.getElementById("takeBtn")

// select preview
feeds.forEach(feed => {

  feed.addEventListener("click", () => {

    feeds.forEach(f => f.classList.remove("preview"))

    feed.classList.add("preview")

    previewSource = feed.dataset.src

    console.log("Preview source:", previewSource)

  })

})


// TAKE button
takeBtn.addEventListener("click", () => {

  if(!previewSource) return

  feeds.forEach(f => f.classList.remove("program"))

  const selected = document.querySelector(`[data-src="${previewSource}"]`)

  selected.classList.add("program")

  programSource = previewSource

  console.log("Program source:", programSource)

})