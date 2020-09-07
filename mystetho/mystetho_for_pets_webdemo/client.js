// ELEMENTS
var ibgResultElement = document.getElementById('ibgResult')
ibgResultElement.textContent = '---'


// AUDIO NODES
var analyserNode = null;
var sourceNode = null;
var scriptNode = null;


// DRAWING
var canvas = document.getElementById('canvasWaveform');
canvas.style.width = '250px';
canvas.style.marginLeft = '27px';
canvas.style.marginBottom = '20px';
canvas.style.marginTop = '20px';
// canvas.width  = canvas.offsetWidth;
canvas.height = 50;
var canvasCtx = canvas.getContext('2d');
var drawLength = 1024
var bufferToDraw = 200
var drawIndex = 0;
var isDrawing = false;

var drawBuffer = new Uint8Array(drawLength);
for (var i = 0; i<drawBuffer.length; i++) {
    drawBuffer[i] = 128
}
draw_canvas();


// WEBSOCKET
var model_loaded = false
var ws = null;

function setupWebSocket() {
//	ws = new WebSocket("ws://localhost:17654/guidance_ws");
	ws = new WebSocket("wss://mystetho-for-pets-cloud.herokuapp.com/guidance_ws");

	ws.onopen = function() {
		console.log("websocket connected");
		ibgResultElement.textContent = 'Connected to server'
		ws.send(JSON.stringify({
          "action": "load model",
          "fs": 8000
        }));
	}

	ws.onmessage = function(e) {
	    console.log(e.data)
	    response = JSON.parse(e.data)
	    if (response['dataType'] == 'message') {
            ibgResultElement.textContent = response['data']
            if (response['data'] == 'AI model loaded') {
                model_loaded = true
            }
	    }
	    else if (response['dataType'] == 'prediction') {
            ibgResultElement.textContent = "Heart detected : " + Math.round(response['data'][0][1]*100) + '%'
	    }
//	    if (e.data == 'Model loaded') {
//            ibgResultElement.textContent = 'AI model loaded'
//	        model_loaded = true
//	    }
	}

	return ws;
}


// AUDIO STREAM
var SAMPLES_PER_CHUNK = 8192;
var audioCtx = null;
var stream = null;

function scriptNode_onaudioprocess(evt) {
    if (model_loaded) {
        var inputBuffer = evt.inputBuffer;
        var inputData = inputBuffer.getChannelData(0);

        var floatBuffer = interleave(new Float32Array(inputData), 44100, 8000)
        var intBuffer = []

        for (i=0; i<floatBuffer.length; i++) {
            intBuffer.push(Math.round(floatBuffer[i]*32767))
        }

        ws.send(JSON.stringify({
            "action": "predict",
            "data": intBuffer
        }));
    }
}

// RECORD
var rec;


// START BUTTON
function start() {
    document.getElementById('start').style.display = 'none';
    ibgResultElement.textContent = "Loading..."
    ws = setupWebSocket();

    var constraints = {
        audio: {
            'noiseSuppression': false,
            'autoGainControl': false,
            'echoCancellation': false,
            channelCount: 1,
            sampleRate: 48000,
            sampleSize: 16,
        },
        video: false
    };

    navigator.mediaDevices.enumerateDevices()
    .then((devices) => {

        devices_filtered = devices.filter((d) => d.kind === 'audioinput' && d.label.includes('USB audio CODEC'));
        if (devices_filtered.length) {
            constraints['audio']['deviceId'] = devices_filtered[0].deviceId
        }

        navigator.mediaDevices.getUserMedia(constraints)
        .then((mediaStream) => {
            stream = mediaStream

            // create nodes
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            sourceNode = audioCtx.createMediaStreamSource(stream);
            analyserNode = audioCtx.createAnalyser();
            scriptNode = audioCtx.createScriptProcessor(SAMPLES_PER_CHUNK, 1, 1);
            scriptNode.onaudioprocess = scriptNode_onaudioprocess;

            // connect nodes
            sourceNode.connect(analyserNode);
            analyserNode.connect(scriptNode);
            scriptNode.connect(audioCtx.destination);

            // start drawing
            isDrawing = true;
            draw()

            // record
            rec = new Recorder(sourceNode,{numChannels:1})
            rec.record()
        })

    })

    document.getElementById('stop').style.display = 'inline-block';
}

// STOP BUTTON
function stop() {
    document.getElementById('stop').style.display = 'none';

    rec.stop();

    if ('getTracks' in stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
    } else {
        stream.stop();
    }

    scriptNode.disconnect(audioCtx.destination);
    analyserNode.disconnect(scriptNode);
    sourceNode.disconnect(analyserNode);
    sourceNode = null;

    isDrawing = false

    rec.exportWAV(createDownloadLink);

    document.getElementById('start').style.display = 'inline-block';
}

// DRAW
function draw() {
    if (!isDrawing) return;
    requestAnimationFrame(draw);

    analyserNode.fftSize = drawLength*2;
    var dataArray = new Uint8Array(drawLength);

    analyserNode.getByteTimeDomainData(dataArray);

    var linspaceArray = linspace_int(0,dataArray.length, Math.round(dataArray.length/bufferToDraw))
    for (var i = 0; i < linspaceArray.length-1; i++) {
        drawBuffer[drawIndex] = dataArray[linspaceArray[i]]
        drawIndex = (drawIndex + 1) % drawLength;
    }

    draw_canvas();
}

function draw_canvas() {
    canvasCtx.fillStyle = 'rgb(255, 255, 255)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    // waveform
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
    canvasCtx.beginPath();

    var sliceWidth = canvas.width * 1.0 / (drawLength-1);
    var x = 0;

    for(var i = 0; i < drawLength; i++) {

            var v = (drawBuffer[i]+1) / 128.0;
            var y = v * canvas.height/2;

            if(i === 0) {
              canvasCtx.moveTo(x, y);
            } else {
              canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
    }
    canvasCtx.stroke();

    // drawIndex
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(256, 0, 0)';
    canvasCtx.beginPath();

    var indexX = drawIndex / (drawLength-1) * canvas.width
    canvasCtx.moveTo(indexX, 0);
    canvasCtx.lineTo(indexX, canvas.height);
    canvasCtx.stroke();
}


// OTHER
function linspace_int(a,b,n) {
    if(typeof n === "undefined") n = Math.max(Math.round(b-a)+1,1);
    if(n<2) { return n===1?[a]:[]; }
    var i,ret = Array(n);
    n--;
    for(i=n;i>=0;i--) { ret[i] = Math.round((i*b+(n-i)*a)/n); }
    return ret;
}

function interleave(e, sampleRate, outputSampleRate){
    var t = e.length;
    sampleRate += 0.0;
    outputSampleRate += 0.0;
    var s = 0,
    o = sampleRate / outputSampleRate,
    u = Math.ceil(t * outputSampleRate / sampleRate),
    a = new Float32Array(u);
    for (i = 0; i < u; i++) {
        a[i] = e[Math.floor(s)];
        s += o;
    }
    return a;
}

function createDownloadLink(blob) {
	var url = URL.createObjectURL(blob);
	var au = document.createElement('audio');
	var li = document.createElement('li');
	var link = document.createElement('a');

	//name of .wav file to use during upload and download (without extendion)
	var filename = new Date().toISOString();

	//add controls to the <audio> element
	au.controls = true;
	au.src = url;

	//save to disk link
	link.href = url;
	link.download = filename+".wav"; //download forces the browser to donwload the file using the  filename
	link.innerHTML = "Save to disk";

	//add the new audio element to li
	li.appendChild(au);

	//add the filename to the li
	li.appendChild(document.createTextNode(filename+".wav "))

	//add the save to disk link to li
	li.appendChild(link);

	//add the li element to the ol
	recordingsList.appendChild(li);
}