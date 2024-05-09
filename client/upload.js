; (function () {
  const input = document.querySelector('#upload-input')
  const img = document.querySelector('#img')
  function changeBuffer(file) {
    return new Promise((resolve) => {
      const fileReader = new FileReader()
      fileReader.readAsArrayBuffer(file)
      fileReader.onload = async function () {
        // 测试216M大小的数据 hashwasm 用时1.7s sparkMd5 用时3.2s
        // 两者都是根据内容生成MD5 所以无论文件名怎么变 只要相同的文件 MD5都是一样的
        console.time('time---')
        let result = new Uint8Array(fileReader.result);
        let hash = await hashwasm.md5(result)
        // let sparkMd5 = new SparkMD5.ArrayBuffer()
        // sparkMd5.append(fileReader.result)
        // let hash = sparkMd5.end()
        console.timeEnd('time---')
        let suffix = /\.([a-zA-Z0-9]+)$/.exec(file.name)[0]
        let fileName = `${hash}${suffix}`
        resolve({
          fileName,
          suffix,
          hash,
          buffer: fileReader.result
        })
      }
    })
  }


  input.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    let {
      suffix,
      hash,
    } = await changeBuffer(file)
    
    // 如果是图片需要预览的话 可以用createObjectURL创建链接
    // 但是记得在加载完成之后调用revokeObjectURL清除文件 不然会占用内存
    img.src = URL.createObjectURL(file)
    img.onload = function () {
      URL.revokeObjectURL(file)
    }

    let max = 1024 * 1024 // 1M
    let count = Math.ceil(file.size / max)
    let index = 0
    let chunks = []
    while (index < count) {
      chunks.push({
        file: file.slice(index * max, (index + 1) * max),
        fileName: `${hash}_${index + 1}${suffix}`
      })
      index++
    }
    let i = 0
    function complete() {
      // 切化上传进度
      i++
      console.log('当前分片上传进度:', i / count * 100)
      if (i < count) return
      axios.get('http://127.0.0.1:8888/single_upload_merge', {
        params: {
          hash
        }
      })
    }
    // 上传之前先查询是否存在切片
    let {
      data: { fileList: alreadyList }
    } = await axios.get('http://127.0.0.1:8888/upload_already', {
      params: {
        hash
      }
    })

    chunks.forEach(item => {
      // 如果存在切片就进行比对，上传过的就跳过，但是计数要进行
      if (alreadyList.length > 0 && alreadyList.includes(item.fileName)) {
        complete()
        return
      }
      let formData = new FormData()
      formData.append('chunk', item.file)
      formData.append('filename', item.fileName)
      axios.post('http://127.0.0.1:8888/single_upload_chunk', formData, {
        // 单文件或者多文件上传可以在这里监听上传进度
        // onUploadProgress(ev) {
        //   console.log('进度:',( ev.loaded / ev.total) * 100)
        // }
      }).then(res => {
        complete()
      })
    })
  })
})()
