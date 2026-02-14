// @SuppressWarnings("javascript:S4144");
document.cookie = "permiso=1";
let isCameraAllowed = false;

define(['jquery', 'core/ajax', 'core/notification'],
    function($, Ajax, Notification) {
        $('#id_submitbutton').prop("disabled", false);
        $(function() {
            $('#id_submitbutton').prop("disabled", false);
            $('#id_proctoring').on('change', function() {
                if (this.checked && isCameraAllowed) {
                    $('#id_submitbutton').prop("disabled", false);
                    document.cookie = "permiso=1";
                } else {
                    $('#id_submitbutton').prop("disabled", false);
                }
            });
        });

        /**
         * Function hideButtons
         *
         * Shows a recommendation message about webcam usage without disabling navigation.
         */
        function hideButtons() {
            var contenidoExistente = $('.submitbtns').html();
            var nuevoParrafo = '<p style="margin: 10px;position: absolute;padding:25px">'
                + '<b>NOTA:</b>Se recomienda utilizar una cámara web en esta prueba, '
                + 'sin embargo, no es obligatorio.</p><br>';
            $('.submitbtns').html(contenidoExistente + nuevoParrafo);
        }

        /**
         * Show a notification to the user.
         *
         * @param {string} message The notification message.
         * @param {string} type The notification type (error, warning, success, info).
         */
        const showNotification = (message, type) => {
            removeNotifications();
            Notification.addNotification({
                message,
                type
            });
        };

        /**
         * Remove all visible alert notifications from the page.
         */
        const removeNotifications = () => {
            try {
                const alertElements = document.getElementsByClassName('alert');
                if (alertElements.length > 0) {
                    Array.from(alertElements).forEach(alertDiv => {
                        alertDiv.style.display = 'none';
                    });
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log(error);
            }
        };

        let firstcalldelay = 3000; // 3 seconds after the page load.
        let takepicturedelay = 30000; // 30 seconds.

        /**
         * Extract a face region from an image using bounding box coordinates.
         *
         * @param {HTMLImageElement} imageRef The source image element.
         * @param {object} box The bounding box with x, y, width, height.
         * @param {object} croppedImage The jQuery element to store the cropped face.
         */
        const extractFaceFromBox = async(imageRef, box, croppedImage) => {
            const regionsToExtract = [
                // eslint-disable-next-line no-undef
                new faceapi.Rect(box.x, box.y, box.width, box.height)
            ];
            // eslint-disable-next-line no-undef
            let faceImages = await faceapi.extractFaces(imageRef, regionsToExtract);

            if (faceImages.length === 0) {
                // eslint-disable-next-line no-console
                console.log('Face not found');
            } else {
                faceImages.forEach((cnv) => {
                    croppedImage.src = cnv.toDataURL();
                });
            }
        };

        /**
         * Detect faces in an image and extract the first detected face.
         *
         * @param {HTMLImageElement} input The image element to analyze.
         * @param {object} croppedImage The jQuery element to store the cropped face.
         * @returns {number} The number of faces detected.
         */
        const detectface = async(input, croppedImage) => {
            // eslint-disable-next-line no-undef
            const output = await faceapi.detectAllFaces(input);
            if (output.length === 0) {
                // eslint-disable-next-line no-console
                console.log('Face not found');
            } else {
                let detections = output[0].box;
                await extractFaceFromBox(input, detections, croppedImage);
            }
            return output.length;
        };

        return {
            /**
             * Setup proctoring with face detection for quiz attempts.
             *
             * @param {object} props Configuration properties including courseid, quizid, image_width, camshotdelay.
             * @param {string} modelurl URL to the face-api model files.
             * @returns {boolean} True on success, false if on summary/review page.
             */
            async setup(props, modelurl) {
                // eslint-disable-next-line babel/no-unused-expressions,no-undef,promise/catch-or-return
                await faceapi.nets.ssdMobilenetv1.loadFromUri(modelurl);
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

                $('#mod_quiz_navblock').append('<div class="card-body p-3"><h3 class="no text-left">Webcam</h3> <br/>'
                    + '<video id="video">Video stream not available.</video>'
                    + '<img id="cropimg" src="" alt=""/><canvas id="canvas" style="display:none;"></canvas>'
                    + '<div class="output" style="display:none;">'
                    + '<img id="photo" alt="The picture will appear in this box."/></div></div>');

                const video = document.getElementById('video');
                const canvas = document.getElementById('canvas');
                const photo = document.getElementById('photo');

                /**
                 * Clear the photo canvas with a gray fill.
                 */
                const clearphoto = () => {
                    const context = canvas.getContext('2d');
                    context.fillStyle = "#AAA";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    data = canvas.toDataURL('image/png');
                    photo.setAttribute('src', data);
                };

                /**
                 * Capture a picture from the video stream, detect faces, and send via web service.
                 */
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
                        const numberFaces = await detectface(photo, croppedImage);
                        let faceFound;
                        let faceImage;
                        if (croppedImage.src) {
                            removeNotifications();
                            faceFound = 1;
                            faceImage = croppedImage.src;
                        } else {
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
                                        message: 'Something went wrong during taking the image.',
                                        type: 'error'
                                    });
                                }
                            }
                        }).fail(Notification.exception);
                    } else {
                        clearphoto();
                    }
                };

                navigator.mediaDevices.getUserMedia({video: true, audio: false})
                    // eslint-disable-next-line promise/always-return
                    .then(function(stream) {
                        video.srcObject = stream;
                        video.play();
                        isCameraAllowed = true;
                    })
                    .catch(function() {
                        hideButtons();
                    });

                if (video) {
                    video.addEventListener('canplay', function() {
                        if (!streaming) {
                            height = video.videoHeight / (video.videoWidth / width);
                            // Firefox currently has a bug where the height can't be read from
                            // the video, so we will make assumptions if this happens.
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
                } else {
                    hideButtons();
                }

                return true;
            },

            /**
             * Initialize proctoring without face detection (basic webcam capture).
             *
             * @param {object} props Configuration properties including courseid, quizid, image_width.
             * @returns {string|null} The last captured image data URL.
             */
            async init(props) {
                let height = 0; // This will be computed based on the input stream.
                let streaming = false;
                let video = null;
                let canvas = null;
                let photo = null;
                let data = null;
                const width = props.image_width;

                /**
                 * Startup - initialize video stream and canvas elements.
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
                                isCameraAllowed = true;
                            })
                            .catch(function() {
                                Notification.addNotification({
                                    message: props.allowcamerawarning,
                                    type: 'warning'
                                });
                                hideButtons();
                            });

                        video.addEventListener('canplay', function() {
                            if (!streaming) {
                                height = video.videoHeight / (video.videoWidth / width);
                                // Firefox currently has a bug where the height can't be read from
                                // the video, so we will make assumptions if this happens.
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
                    } else {
                        hideButtons();
                    }
                    clearphoto();
                }

                /**
                 * Clear the photo canvas with a gray fill.
                 */
                function clearphoto() {
                    if (isCameraAllowed) {
                        var context = canvas.getContext('2d');
                        context.fillStyle = "#AAA";
                        context.fillRect(0, 0, canvas.width, canvas.height);

                        data = canvas.toDataURL('image/png');
                        photo.setAttribute('src', data);
                    } else {
                        hideButtons();
                    }
                }

                /**
                 * Capture a picture from the video stream and send via web service.
                 */
                async function takepicture() {
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
                                    message: 'Something went wrong during taking screenshot.',
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