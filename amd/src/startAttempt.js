define(['jquery', 'core/ajax', 'core/notification'],
    function($, Ajax, Notification) {

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
        };

        return {
            /**
             * Setup face validation for quiz attempt start.
             *
             * Loads the face-api model, captures a webcam frame on button click,
             * detects and extracts the face, then validates it against the profile image
             * via the quizaccess_proctoring_validate_face web service.
             *
             * @param {object} props Configuration properties including imagewidth.
             * @param {string|null} modelurl URL to the face-api model files, or null to skip face detection.
             * @returns {boolean} True on successful setup.
             */
            setup: async function(props, modelurl) {
                if (modelurl != null) {
                    // eslint-disable-next-line no-undef
                    await faceapi.nets.ssdMobilenetv1.loadFromUri(modelurl);
                }

                $('#fcvalidate').append('<img id="validate-cropimg" style="display: none;" src="" alt=""/>');
                $("#fcvalidate").click(async function(event) {

                    event.preventDefault();
                    const photo = document.getElementById('photo');
                    const canvas = document.getElementById('canvas');
                    const video = document.getElementById('video');
                    const context = canvas.getContext('2d');
                    canvas.width = props.imagewidth;

                    canvas.height = canvas.width / (4 / 3);
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    var data = canvas.toDataURL('image/png');
                    photo.setAttribute('src', data);

                    const courseid = document.getElementById('courseidval').value;
                    const cmid = document.getElementById('cmidval').value;
                    const profileimage = document.getElementById('profileimage').value;

                    // Getting the face image from screenshot.
                    let croppedImage = $('#validate-cropimg');
                    if (modelurl != null) {
                        await detectface(photo, croppedImage);
                    }

                    let faceFound;
                    let faceImage;
                    if (croppedImage.src) {
                        faceFound = 1;
                        faceImage = croppedImage.src;
                    } else {
                        faceFound = 0;
                        faceImage = "";
                    }

                    const wsfunction = 'quizaccess_proctoring_validate_face';
                    const params = {
                        'courseid': courseid,
                        'cmid': cmid,
                        'profileimage': profileimage,
                        'webcampicture': data,
                        'parenttype': 'camshot_image',
                        'faceimage': faceImage,
                        'facefound': faceFound,
                    };

                    const request = {
                        methodname: wsfunction,
                        args: params
                    };

                    document.getElementById('loading_spinner').style.display = 'block';
                    Ajax.call([request])[0].done(function(res) {
                        if (res.warnings.length < 1) {
                            document.getElementById('loading_spinner').style.display = 'none';
                            var status = res.status;
                            if (status === 'success') {
                                $("#video").css("border", "10px solid green");
                                $("#face_validation_result").html('<span style="color: green">True</span>');
                                document.getElementById("fcvalidate").style.display = "none";
                                $("#form_activate").css("visibility", "visible");
                            } else {
                                $("#video").css("border", "10px solid red");
                                $("#face_validation_result").html('<span style="color: red">False</span>');
                            }
                        } else {
                            document.getElementById('loading_spinner').style.display = 'none';
                            if (video) {
                                Notification.addNotification({
                                    message: 'Something went wrong during taking the image.',
                                    type: 'error'
                                });
                            }
                        }
                    }).fail(Notification.exception);

                });

                return true;
            }
        };
    });
