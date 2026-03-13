<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Spanish (Mexico) language strings for quizaccess_proctoring.
 *
 * @package    quizaccess_proctoring
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

// Modal preflight.
$string['openwebcam'] = 'Verificación de identidad';
$string['proctoringstatement'] = 'Este examen requiere acceso a tu cámara web y micrófono. Durante la prueba se tomarán fotografías y se grabará el audio para verificar tu identidad y garantizar la integridad del examen.';
$string['proctoringlabel'] = 'Entiendo y acepto que se tomarán fotografías y se grabará audio durante este examen.';
$string['youmustagree'] = 'Debes aceptar los términos de supervisión antes de continuar.';
$string['proctoringheader'] = '<strong>Este cuestionario utiliza supervisión. Se tomarán fotografías periódicamente durante el examen con tu cámara web para verificar tu identidad.</strong>';

// Camera / microphone status messages.
$string['info:cameraallow'] = 'Tu cámara está en uso.';
$string['info:cameraandmicready'] = 'Cámara y micrófono listos. Ya puedes continuar.';
$string['warning:cameraallowwarning'] = 'Por favor, permite el acceso a la cámara.';
$string['warning:cameraandmicdenied'] = 'Se requiere acceso a la cámara y el micrófono para iniciar el examen. Permite el acceso en la configuración de tu navegador y recarga la página.';

// Face validation modal.
$string['modal:facevalidation'] = 'Rostro validado:';
$string['modal:pending'] = 'Pendiente';
$string['modal:validateface'] = 'Validar reconocimiento facial';

// General UI.
$string['facenotfoundoncam'] = 'No se detectó un rostro. Asegúrate de estar frente a la cámara.';
$string['wrong_during_taking_image'] = 'Ocurrió un error al capturar la imagen.';
$string['wrong_during_taking_screenshot'] = 'Ocurrió un error al tomar la captura de pantalla.';
$string['enable_web_camera_before_submitting'] = 'Activa tu cámara web antes de enviar el examen.';
$string['webcam'] = 'Cámara web';
$string['videonotavailable'] = 'Video no disponible.';
