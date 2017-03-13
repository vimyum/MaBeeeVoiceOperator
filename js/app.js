Vue.use(VueMaterial);
var fs = require('fs');
var segmenter = new TinySegmenter(); // インスタンス生成 

var dict = JSON.parse(fs.readFileSync('./js/dict.js', 'utf8'));
var mouseStatus = false;

var maBeee = {
    on : () => {
        return axios.get('http://localhost:11111/devices/1/set?pwm_duty=80');
    },
    off : () => {
        return axios.get('http://localhost:11111/devices/1/set?pwm_duty=0');
    },
    up : () => {
        return axios.get('http://localhost:11111/devices/1/set?pwm_duty=100');
    },
    down : () => {
        return axios.get('http://localhost:11111/devices/1/set?pwm_duty=60');
    },
};

var vm = new Vue({
    el: '#app', // document.getElementById('example'), $('#example')[0] も可
    data: {
        message: 'Talk to Me!',
        connected: false,
        statusMessage: 'Trying to connect to MaBeee.',
        price: 100,
    },
    methods: {
        onClick: function() {
            console.log('clicked...');
        },
        onMouseDown: function() {
            console.log('down...');
            mouseStatus = true;
            startRecord();
        },
        onMouseUp: function() {
            if (!mouseStatus) { 
                return;
            }
            mouseStatus = false;
            stopRecord();
            console.log('up...');
        },
    }
});

function getMode() {
    return Microsoft.CognitiveServices.SpeechRecognition.SpeechRecognitionMode.shortPhrase;
}

function getKey() {
    console.log('key:' + document.getElementById("key").value);
    return document.getElementById("key").value;
}

function getLanguage() {
    return "ja-jp";
}

function clearText() {
    document.getElementById("output").value = "";
    app.data.recognized = "";
}

var started = false;
var timeout_id;
var client = Microsoft.CognitiveServices.SpeechRecognition.SpeechRecognitionServiceFactory.createMicrophoneClient(
        getMode(),
        getLanguage(),
        getKey());

function startRecord() {
    console.log("start is called.");
    console.log('call createMicrophoneClient');
    console.log('call createMicrophoneClient end');

    started = true;
    client.startMicAndRecognition();

    console.log("start Mice and Recognition.");

    timeout_id = setTimeout(stopRecord, 5000);

    client.onPartialResponseReceived = function (response) {
        vm.message = response[0].transcript;
    }

    client.onIntentReceived = function (response) {
        vm.message = response[0].transcript;
    };

    client.onFinalResponseReceived = function (response) {
        console.log('response:\n' + JSON.stringify(response, null, '    '));

        vm.message = response[0].transcript;
       
        // 応答テキストを形態素解析
        var segs = segmenter.segment(response[0].transcript); 

        segs.reverse().forEach((seg) => {
            Object.keys(dict).forEach((key) => {
                console.log('key:' + key + ', seg:' + seg + ', dict[key]:' + JSON.stringify(dict[key]));
                if (dict[key].includes(seg)) {
                    maBeee[key]().then((val)=> {
                        console.log('Succeed to call MaBeee API.');
                    }).catch((err) => {
                        console.log('failed to call MaBeee API.');
                    });
                }
            });
        });

    }
}

function stopRecord () {
    console.log("stop is called");
    if (started) {
        console.log("end Mice and Recognition.");
        client.endMicAndRecognition();
    }
    if (timeout_id) {
        clearTimeout(timeout_id);
        timeout_id = null;
    }
    started = false;
}



axios.get('http://localhost:11111/scan/start')
.then((response) => {
    var retry_cntr = 0;
    return new Promise(function loop(resolve, reject) {
        return new Promise((_resolve, _reject) => {
            axios.get('http://localhost:11111/devices').then((_response)=> {
                console.log('Attempting get device info:' + retry_cntr);
                if (!_response.data.devices[0]) {
                    // 未検出ならば
                    // リトライが３回失敗したら諦める
                    if (retry_cntr++ > 5) {
                        _reject(null);
                    }
                    // 2秒後にリトライ
                    setTimeout(()=> {
                        _resolve(true);
                    }, 3000);
                } else {
                    // 検出されたならば
                    _reject(_response.data.devices[0]);
                }
            });
        }).then(loop.bind(null, resolve, reject),
            (device) => {
            console.log('end of try..:' + JSON.stringify(device));
            if (device) {
                return resolve(device);
            } else {
                console.log('Deviceは検出されませんでした');
                reject();
            }
        });
    });
}).then((device)=> {
    /* Device 検出後の処理 */
    console.log('Deviceが検出されました' + JSON.stringify(device, null, '   '));
    // 接続
    return axios.get('http://localhost:11111/devices/' + device.id + '/connect')

}).then((_resonse) => {

	var retry_cntr = 0;
    return new Promise(function loop(resolve, reject) {
        return new Promise((_resolve, _reject) => {

            // 接続状態確認
            axios.get('http://localhost:11111/devices/1').then((_response)=> {
                console.log('Attempting connect to device:' + retry_cntr);
                if (_response.data.state !== 'Connected') {
                    // 未接続ならならば
                    // リトライが３回失敗したら諦める
                    if (retry_cntr++ > 3) {
                        _reject(null);
                    }
                    // 3秒後にリトライ
                    setTimeout(()=> {
                        _resolve(true);
                    }, 3000);
                } else {
                    // 検出されたならば
                    _reject(_response.data);
                }
            });
        }).then(loop.bind(null, resolve, reject),
            (connect) => {
            console.log('end of try..:' + JSON.stringify(connect));
            if (connect) {
                console.log('接続できました:' + JSON.stringify(connect));
                return resolve(connect);
            } else {
                console.log('接続できませんでした');
                reject();
            }
        });
    });
}).then((connect) => {
    vm.connected = true;
    vm.statusMessage = 'Connected to MaBeee.';
    return axios.get('http://localhost:11111/scan/stop');
}).catch((err)=>{
    console.log('失敗しました:' + err);
    vm.statusMessage = 'Failed to connect to MaBeee.';
});

