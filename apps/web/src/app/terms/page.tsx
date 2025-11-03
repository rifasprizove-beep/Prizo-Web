export default function TermsPage() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <main className="site-container py-8 text-white">
      <h1 className="text-3xl font-extrabold mb-2">Términos y Condiciones</h1>
      <p className="text-sm text-gray-400 mb-6">Última actualización: {today}</p>

      <section className="prose prose-invert max-w-none">
        <h2>1. Aceptación</h2>
        <p>
          Al acceder y utilizar la plataforma PRIZO (la “Plataforma”), aceptas estos Términos y Condiciones (los
          “Términos”). Si no estás de acuerdo, debes abstenerte de usar la Plataforma.
        </p>

        <h2>2. Elegibilidad</h2>
        <p>Debes tener al menos 18 años para participar en rifas o utilizar la Plataforma.</p>

        <h2>3. Cuentas y verificación</h2>
        <p>
          Podemos solicitar verificación de identidad cuando sea necesario para prevenir fraude o confirmar la
          legitimidad de una participación, incluyendo revisión de correo, teléfono, cédula e Instagram.
        </p>

        <h2>4. Participaciones</h2>
        <ul>
          <li>En rifas gratuitas, se admite una (1) participación por persona y por rifa.</li>
          <li>Nos reservamos el derecho de anular participaciones duplicadas, automatizadas o sospechosas.</li>
          <li>Las participaciones están sujetas a disponibilidad y reglas particulares de cada rifa.</li>
        </ul>

        <h2>5. Rifas pagas, pagos y comprobantes</h2>
        <ul>
          <li>Debes seguir las instrucciones de pago indicadas para cada rifa.</li>
          <li>Los comprobantes pueden ser verificados; podremos aprobarlos o rechazarlos si son inválidos o insuficientes.</li>
          <li>Las reservas o compras no garantizan la obtención de un número específico salvo que se indique expresamente.</li>
        </ul>

        <h2>6. Selección de ganadores y entrega de premios</h2>
        <ul>
          <li>Los ganadores se determinan según el mecanismo publicado para cada rifa.</li>
          <li>La entrega del premio requiere verificación de identidad del ganador y cumplimiento de las reglas.</li>
          <li>Si el ganador no responde dentro del plazo razonable indicado, podremos declarar el premio desierto o elegir un suplente.</li>
        </ul>

        <h2>7. Conducta prohibida</h2>
        <p>
          Está prohibido el uso fraudulento, automatizado o abusivo de la Plataforma, la manipulación de resultados, la
          suplantación de identidad y cualquier actividad que vulnere la ley o los presentes Términos. Podemos suspender o
          cancelar cuentas y participaciones en tales casos.
        </p>

        <h2>8. Datos personales y privacidad</h2>
        <p>
          Utilizamos tus datos para gestionar tu participación, realizar verificaciones y contactarte en caso de resultar
          ganador. Al continuar, consientes el tratamiento de tus datos conforme a nuestra política de privacidad. Podrás
          ejercer tus derechos de acceso, rectificación y supresión escribiendo a nuestros canales de contacto.
        </p>

        <h2>9. Propiedad intelectual</h2>
        <p>
          Las marcas, imágenes y contenidos de la Plataforma pertenecen a sus respectivos titulares. No adquieres
          derechos sobre ellos por el mero uso de la Plataforma.
        </p>

        <h2>10. Responsabilidad</h2>
        <p>
          La Plataforma se ofrece “tal cual”. En la medida permitida por la ley, PRIZO no será responsable por daños
          indirectos o pérdida de beneficios derivados del uso de la Plataforma o de la participación en rifas.
        </p>

        <h2>11. Modificaciones</h2>
        <p>
          Podemos actualizar estos Términos en cualquier momento. Publicaremos la versión vigente y, cuando corresponda,
          te notificaremos los cambios relevantes.
        </p>

        <h2>12. Contacto</h2>
        <p>
          Si tienes dudas sobre estos Términos, contáctanos a través de nuestros canales oficiales publicados en la
          Plataforma.
        </p>
      </section>
    </main>
  );
}
