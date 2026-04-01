/**
 * Quiz finish module — shows a modal on the summary page that triggers
 * the Cloud Run analysis web service before allowing the form to submit.
 *
 * @module     quizaccess_proctoring/quizfinish
 * @copyright  2024 Brain Station 23
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['core/ajax', 'core/notification', 'core/modal_factory', 'core/modal_events', 'core/str'],
function(Ajax, Notification, ModalFactory, ModalEvents, Str) {

    /**
     * Submit the form, ensuring the finishattempt field is present.
     *
     * @param {HTMLFormElement} form
     */
    var submitForm = function(form) {
        if (!form.querySelector('input[name="finishattempt"]')) {
            var hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = 'finishattempt';
            hidden.value = '1';
            form.appendChild(hidden);
        }
        form.submit();
    };

    return {
        /**
         * Initialise the quiz finish interceptor.
         *
         * @param {Object} props Record passed from rule.php (contains courseid, quizid, status).
         */
        init: function(props) {
            // Only run on the quiz summary page.
            if (!document.getElementById('page-mod-quiz-summary')) {
                return;
            }

            // Find the submit button (Moodle uses .mod_quiz-next-nav on quiz nav buttons).
            var submitBtn = document.querySelector('.mod_quiz-next-nav')
                || document.querySelector('button[type="submit"]');
            if (!submitBtn) {
                return;
            }

            var form = submitBtn.closest('form');
            if (!form) {
                return;
            }

            // Intercept the click in the capture phase so it fires before
            // Moodle's own confirmation dialog handler.
            submitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopImmediatePropagation();

                Str.get_strings([
                    {key: 'quizfinish:modal_title', component: 'quizaccess_proctoring'},
                    {key: 'quizfinish:modal_body', component: 'quizaccess_proctoring'},
                    {key: 'quizfinish:modal_submit', component: 'quizaccess_proctoring'},
                    {key: 'quizfinish:modal_processing', component: 'quizaccess_proctoring'},
                ]).then(function(strings) {
                    return ModalFactory.create({
                        type: ModalFactory.types.SAVE_CANCEL,
                        title: strings[0],
                        body: strings[1],
                    }).then(function(modal) {
                        modal.setSaveButtonText(strings[2]);

                        modal.getRoot().on(ModalEvents.save, function(ev) {
                            ev.preventDefault();

                            // Disable save button and show processing text.
                            var saveBtn = modal.getRoot().find('[data-action="save"]');
                            saveBtn.prop('disabled', true).text(strings[3]);

                            Ajax.call([{
                                methodname: 'quizaccess_proctoring_trigger_analysis',
                                args: {
                                    courseid: props.courseid,
                                    quizid: props.quizid,
                                    attemptid: props.status,
                                }
                            }])[0]
                                .done(function() {
                                    modal.destroy();
                                    submitForm(form);
                                })
                                .fail(function() {
                                    // Even on failure, allow submission so the student is not blocked.
                                    modal.destroy();
                                    submitForm(form);
                                });
                        });

                        modal.show();
                        return modal;
                    });
                }).catch(Notification.exception);
            }, true); // useCapture = true
        }
    };
});