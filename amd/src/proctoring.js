// @SuppressWarnings("javascript:S4144");

define(['jquery', 'core/ajax', 'core/notification', 'core/str'],
    function($, Ajax, Notification, Str) {
        const loadStrings = async function() {
            const stringkeys = [
                {key: 'facenotfoundoncam', component: 'quizaccess_proctoring'},
                {key: 'wrong_during_taking_image', component: 'quizaccess_proctoring'},
                {key: 'wrong_during_taking_screenshot', component: 'quizaccess_proctoring'},
                {key: 'enable_web_camera_before_submitting', component: 'quizaccess_proctoring'},
                {key: 'webcam', component: 'quizaccess_proctoring'},
                {key: 'videonotavailable', component: 'quizaccess_proctoring'},
                {key: 'warning:devicerequired', component: 'quizaccess_proctoring'},
            ];
            try {
                const strings = await Str.get_strings(stringkeys);
                return {
                    facenotfoundoncam: strings[0],
                    wrongduringtakingimage: strings[1],
                    wrongduringtakingscreenshot: strings[2],
                    enablewebcamerabeforesubmitting: strings[3],
                    webcam: strings[4],
                    videonotavailable: strings[5],
                    devicerequired: strings[6],
                };
            } catch (error) {
                Notification.exception(error);
                return {}; // Return an empty object in case of an error.
            }
        };

        $('#id_submitbutton').prop("disabled", true);
        $(function() {
            $('#id_submitbutton').prop("disabled", true);
            $('#id_proctoring').on('change', function() {
                $('#id_submitbutton').prop("disabled", !this.checked);
            });
        });

        const showNotification = (message, type) => {
            removeNotifications();
            Notification.addNotification({
                message,
                type
            });
        };

        const removeNotifications = () => {
            try {
                const alertElements = document.getElementsByClassName('alert');
                if (alertElements.length > 0) {
                    Array.from(alertElements).forEach(alertDiv => {
                        alertDiv.style.display = 'none';
                    });
                }
            } catch (error) {
                Notification.exception(error);
            }
        };

        let firstcalldelay = 3000; // 3 seconds after the page load.
        let takepicturedelay = 30000; // 30 seconds.

        // Function to draw image from the box data.
        const extractFaceFromBox = async(imageRef, box, croppedImage) => {
            const regionsToExtract = [
                // eslint-disable-next-line no-undef
                new faceapi.Rect(box.x, box.y, box.width, box.height)
            ];
            // eslint-disable-next-line no-undef
            let faceImages = await faceapi.extractFaces(imageRef, regionsToExtract);

            if (faceImages.length !== 0) {
                faceImages.forEach((cnv) => {
                    croppedImage.src = cnv.toDataURL();
                });
            }
        };

        const detectface = async(input, croppedImage) => {
            // eslint-disable-next-line no-undef
            const output = await faceapi.detectAllFaces(input);
            if (output.length !== 0) {
                let detections = output[0].box;
                await extractFaceFromBox(input, detections, croppedImage);
            }
        };

        return {
            async setup(props, modelurl) {
                const strings = await loadStrings();
                if (modelurl !== null) {
                    // eslint-disable-next-line no-undef
                    await faceapi.nets.ssdMobilenetv1.loadFromUri(modelurl);
                }
                takepicturedelay = props.camshotdelay;
                // Skip for summary page.
                if (document.getElementById("page-mod-quiz-summary") !== null &&
                    document.getElementById("page-mod-quiz-summary").innerHTML.length) {
                    return false;
                }
                if (document.getElementById("page-mod-quiz-review") !== null &&
                    document.getElementById("page-mod-quiz-review").innerHTML.length) {
                    return false;
                }

                const width = props.image_width;
                let height = 0; // This will be computed based on the input stream.
                let streaming = false;
                let data = null;

                $('body').append(`<div class="proctoring-fixed-webcam-box d-flex">`
                    + `<video id="video">${strings.videonotavailable}</video>`
                    + '<img id="cropimg" src="" alt=""/><canvas id="canvas" style="display:none;"></canvas>'
                    + '<div class="output" style="display:none;">'
                    + '<img id="photo" alt="The picture will appear in this box."/></div></div>'
                    + '<div id="proctoring-audio-indicator">'
                    + '<span class="proctoring-rec-dot"></span>REC</div>');

                const video = document.getElementById('video');
                const canvas = document.getElementById('canvas');
                const photo = document.getElementById('photo');

                const makeElementDraggable = (element) => {
                let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

                    const dragMouseDown = (e) => {
                        e.preventDefault();
                        pos3 = e.clientX;
                        pos4 = e.clientY;

                        document.onmouseup = closeDragElement;
                        document.onmousemove = elementDrag;
                    };

                    const elementDrag = (e) => {
                        e.preventDefault();
                        pos1 = pos3 - e.clientX;
                        pos2 = pos4 - e.clientY;
                        pos3 = e.clientX;
                        pos4 = e.clientY;

                        element.style.top = element.offsetTop - pos2 + "px";
                        element.style.left = element.offsetLeft - pos1 + "px";
                        element.style.bottom = element.offsetTop - pos2 + 200 + "px";
                        element.style.right = element.offsetLeft - pos1 + 200 + "px";
                    };

                    const closeDragElement = () => {
                        document.onmouseup = null;
                        document.onmousemove = null;
                    };

                    element.onmousedown = dragMouseDown;
                };
                makeElementDraggable(video);

                const clearphoto = () => {
                    const context = canvas.getContext('2d');
                    context.fillStyle = "#AAA";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    data = canvas.toDataURL('image/png');
                    photo.setAttribute('src', data);
                };

                const takepicture = async() => {
                    const context = canvas.getContext('2d');
                    if (width && height) {
                        canvas.width = width;
                        canvas.height = height;
                        context.drawImage(video, 0, 0, width, height);
                        data = canvas.toDataURL('image/png');
                        photo.setAttribute('src', data);
                        props.webcampicture = data;

                        let croppedImage = $('#cropimg');
                        if (modelurl !== null) {
                            await detectface(photo, croppedImage);
                        }
                        let faceFound;
                        let faceImage;
                        if (croppedImage.src) {
                            if (modelurl !== null) {
                                removeNotifications();
                            }
                            faceFound = 1;
                            faceImage = croppedImage.src;
                        } else {
                            if (modelurl !== null) {
                                showNotification(strings.facenotfoundoncam, 'error');
                            }
                            faceFound = 0;
                            faceImage = "";
                        }
                        var wsfunction = 'quizaccess_proctoring_send_camshot';
                        var params = {
                            'courseid': props.courseid,
                            'screenshotid': props.id,
                            'quizid': props.quizid,
                            'webcampicture': data,
                            'imagetype': 1,
                            'parenttype': 'camshot_image',
                            'faceimage': faceImage,
                            'facefound': faceFound,
                        };

                        var request = {
                            methodname: wsfunction,
                            args: params
                        };

                        Ajax.call([request])[0].done(function(res) {
                            if (res.warnings.length >= 1) {
                                if (video) {
                                    Notification.addNotification({
                                        message: strings.wrongduringtakingimage,
                                        type: 'error'
                                    });
                                }
                            }
                        }).fail(Notification.exception);
                    } else {
                        clearphoto();
                    }
                };

                // Device state: mic starts as OK if MediaRecorder is unsupported (can't check).
                const deviceState = {
                    camera: false,
                    mic: typeof MediaRecorder === 'undefined',
                };

                // Blocking overlay — covers the quiz when a required device is unavailable.
                const blockOverlay = document.createElement('div');
                blockOverlay.id = 'proctoring-device-block';
                blockOverlay.innerHTML =
                    '<div class="proctoring-device-block-box">'
                    + '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i>'
                    + '<p>' + strings.devicerequired + '</p>'
                    + '</div>';
                blockOverlay.style.display = 'none';
                document.body.appendChild(blockOverlay);

                // Track how many getUserMedia calls are still pending.
                // Only activate blocking once all have settled to avoid startup flicker.
                let pendingChecks = typeof MediaRecorder !== 'undefined' ? 2 : 1;

                const checkDevices = function() {
                    if (pendingChecks > 0) {
                        return; // Still waiting for devices to initialise.
                    }
                    if (!deviceState.camera || !deviceState.mic) {
                        blockOverlay.style.display = 'flex';
                    } else {
                        blockOverlay.style.display = 'none';
                    }
                };

                const mediaSettled = function() {
                    if (pendingChecks > 0) {
                        pendingChecks--;
                    }
                    checkDevices();
                };

                // Periodically verify tracks are still live (fallback for onended).
                setInterval(function() {
                    if (video && video.srcObject) {
                        const vTracks = video.srcObject.getVideoTracks();
                        if (vTracks.length === 0 || vTracks[0].readyState === 'ended') {
                            deviceState.camera = false;
                        }
                    }
                    checkDevices();
                }, 3000);

                navigator.mediaDevices.getUserMedia({video: true, audio: false})
                    // eslint-disable-next-line promise/always-return
                    .then(function(stream) {
                        video.srcObject = stream;
                        video.play();
                        deviceState.camera = true;
                        mediaSettled();
                        const vTrack = stream.getVideoTracks()[0];
                        if (vTrack) {
                            vTrack.onended = function() {
                                deviceState.camera = false;
                                checkDevices();
                            };
                        }
                    })
                    .catch(function() {
                        deviceState.camera = false;
                        mediaSettled();
                    });

                // Audio recording — microphone required.
                if (typeof MediaRecorder !== 'undefined') {
                    navigator.mediaDevices.getUserMedia({audio: true, video: false})
                        // eslint-disable-next-line promise/always-return
                        .then(function(audioStream) {
                            deviceState.mic = true;
                            mediaSettled();
                            const aTrack = audioStream.getAudioTracks()[0];
                            if (aTrack) {
                                aTrack.onended = function() {
                                    deviceState.mic = false;
                                    checkDevices();
                                };
                            }
                            const audioIndicator = document.getElementById('proctoring-audio-indicator');
                            if (audioIndicator) {
                                audioIndicator.style.display = 'flex';
                            }
                            const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', ''].find(
                                function(t) { return t === '' || MediaRecorder.isTypeSupported(t); }
                            );
                            const recorderOptions = mimeType ? {mimeType} : {};
                            const mediaRecorder = new MediaRecorder(audioStream, recorderOptions);
                            let audioChunkIndex = 0;

                            const hideAudioIndicator = function() {
                                if (audioIndicator) {
                                    audioIndicator.style.display = 'none';
                                }
                            };

                            const captureChunk = function() {
                                if (mediaRecorder.state === 'recording') {
                                    return; // Previous chunk still recording, skip.
                                }
                                const chunks = [];
                                mediaRecorder.ondataavailable = function(e) {
                                    if (e.data && e.data.size > 0) {
                                        chunks.push(e.data);
                                    }
                                };
                                mediaRecorder.onstop = function() {
                                    hideAudioIndicator();
                                    if (chunks.length === 0) {
                                        return;
                                    }
                                    const blob = new Blob(chunks, {type: mediaRecorder.mimeType || 'audio/webm'});
                                    const reader = new FileReader();
                                    const currentIndex = audioChunkIndex++;
                                    reader.onloadend = function() {
                                        Ajax.call([{
                                            methodname: 'quizaccess_proctoring_send_audio_chunk',
                                            args: {
                                                'courseid': props.courseid,
                                                'quizid': props.quizid,
                                                'attemptid': props.id,
                                                'chunkindex': currentIndex,
                                                'audiodata': reader.result,
                                                'mimetype': mediaRecorder.mimeType || 'audio/webm',
                                            }
                                        }])[0].fail(Notification.exception);
                                    };
                                    reader.readAsDataURL(blob);
                                };
                                if (audioIndicator) {
                                    audioIndicator.style.display = 'flex';
                                }
                                mediaRecorder.start();
                                setTimeout(function() {
                                    if (mediaRecorder.state === 'recording') {
                                        mediaRecorder.stop();
                                    }
                                }, props.audiochunkduration);
                            };

                            // First capture after one full interval, then repeat.
                            setTimeout(captureChunk, props.audiocaptureinterval);
                            setInterval(captureChunk, props.audiocaptureinterval);
                        })
                        .catch(function() {
                            deviceState.mic = false;
                            mediaSettled();
                        });
                }

                if (video) {
                    video.addEventListener('canplay', function() {
                        if (!streaming) {
                            height = video.videoHeight / (video.videoWidth / width);
                            // Firefox currently has a bug where the height can't be read from.
                            // The video, so we will make assumptions if this happens.
                            if (isNaN(height)) {
                                height = width / (4 / 3);
                            }
                            video.setAttribute('width', width);
                            video.setAttribute('height', height);
                            canvas.setAttribute('width', width);
                            canvas.setAttribute('height', height);
                            streaming = true;
                        }
                    }, false);

                    // Allow to click picture.
                    video.addEventListener('click', async function(ev) {
                        await takepicture();
                        ev.preventDefault();
                    }, false);
                    setTimeout(takepicture, firstcalldelay);
                    setInterval(takepicture, takepicturedelay);
                }

                return true;
            },
            async init(props) {
                let height = 0; // This will be computed based on the input stream.
                let streaming = false;
                let cameraAvailable = false;
                let video = null;
                let canvas = null;
                let photo = null;
                let data = null;
                const width = props.image_width;

                /**
                 * Startup
                 */
                async function startup() {
                    video = document.getElementById('video');
                    canvas = document.getElementById('canvas');
                    photo = document.getElementById('photo');

                    if (video) {
                        navigator.mediaDevices.getUserMedia({video: true, audio: false})
                            // eslint-disable-next-line promise/always-return
                            .then(function(stream) {
                                video.srcObject = stream;
                                video.play();
                                cameraAvailable = true;

                                Notification.addNotification({
                                    message: props.cameraallow,
                                    type: 'success' // Success notification type.
                                });
                            })
                            .catch(function() {
                                Notification.addNotification({
                                    message: props.allowcamerawarning,
                                    type: 'warning'
                                });
                            });

                        video.addEventListener('canplay', function() {
                            if (!streaming) {
                                height = video.videoHeight / (video.videoWidth / width);
                                // Firefox currently has a bug where the height can't be read from.
                                // The video, so we will make assumptions if this happens.
                                if (isNaN(height)) {
                                    height = width / (4 / 3);
                                }
                                video.setAttribute('width', width);
                                video.setAttribute('height', height);
                                canvas.setAttribute('width', width);
                                canvas.setAttribute('height', height);
                                streaming = true;
                            }
                        }, false);

                        // Allow to click picture.
                        video.addEventListener('click', async function(ev) {
                            await takepicture();
                            ev.preventDefault();
                        }, false);
                    }
                    clearphoto();
                }

                /**
                 * Clearphoto
                 */
                function clearphoto() {
                    if (cameraAvailable) {
                        var context = canvas.getContext('2d');
                        context.fillStyle = "#AAA";
                        context.fillRect(0, 0, canvas.width, canvas.height);

                        data = canvas.toDataURL('image/png');
                        photo.setAttribute('src', data);
                    }
                }

                /**
                 * Takepicture
                 */
                async function takepicture() {

                    const strings = await loadStrings();

                    var context = canvas.getContext('2d');
                    if (width && height) {
                        $(document).trigger("screenshoottaken");
                        canvas.width = width;
                        canvas.height = height;
                        context.drawImage(video, 0, 0, width, height);
                        data = canvas.toDataURL('image/png');
                        photo.setAttribute('src', data);

                        var wsfunction = 'quizaccess_proctoring_send_camshot';
                        var params = {
                            'courseid': props.courseid,
                            'screenshotid': props.id,
                            'quizid': props.quizid,
                            'webcampicture': data,
                            'imagetype': 1
                        };

                        var request = {
                            methodname: wsfunction,
                            args: params
                        };

                        Ajax.call([request])[0].done(async function(res) {
                            if (res.warnings.length >= 1) {
                                Notification.addNotification({
                                    message: strings.wrongduringtakingscreenshot,
                                    type: 'error'
                                });
                            }
                        }).fail(Notification.exception);

                    } else {
                        clearphoto();
                    }
                }

                await startup();

                return data;
            }
        };
    });
