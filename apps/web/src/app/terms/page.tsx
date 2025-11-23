export default function TermsPage() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <main className="site-container py-8 text-white">
      <h1 className="text-5xl font-extrabold tracking-tight mb-4">Términos y Condiciones</h1>
      <p className="text-base text-gray-400 mb-8">Última actualización: {today}</p>

      {/* (Índice y nota eliminados a petición del usuario) */}

      <section className="prose prose-invert prose-lg max-w-none">
        <h2 id="aceptacion" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">1. Aceptación</h2>
        <p>Al acceder y utilizar la plataforma PRIZO, disponible a través de “prizove.com” (en adelante, la “Plataforma”), aceptas estos Términos y Condiciones. Si no estás de acuerdo con alguna de sus disposiciones, debes abstenerte de utilizar la Plataforma.</p>

        <h2 id="elegibilidad" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">2. Elegibilidad</h2>
        <p>Debes tener al menos 18 años para participar en cualquier rifa o utilizar las funcionalidades principales de la Plataforma.</p>

        <h2 id="cuentas" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">3. Cuentas y verificación</h2>
        <p>Podemos solicitar procesos de verificación de identidad cuando sea necesario para prevenir fraude o confirmar la legitimidad de una participación. Esto puede incluir la validación de correo electrónico, número telefónico, cédula de identidad, redes sociales (como Instagram) u otros datos relevantes.</p>

        <h2 id="participaciones" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">4. Participaciones</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>En las rifas gratuitas, se admite una (1) participación por persona y por rifa.</li>
          <li>Nos reservamos el derecho de anular participaciones duplicadas, automatizadas, sospechosas o que incumplan las reglas.</li>
          <li>Todas las participaciones están sujetas a disponibilidad y a las condiciones específicas de cada rifa, las cuales se publicarán en su respectiva sección dentro de la Plataforma.</li>
        </ul>

        <h2 id="pagos" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">5. Rifas de pago, pagos y comprobantes</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>En las rifas de pago, deberás seguir las instrucciones de pago establecidas para cada rifa.</li>
          <li>Los comprobantes de pago podrán ser verificados para confirmar su validez. Podemos aprobarlos o rechazarlos si son considerados inválidos, ilegibles o insuficientes.</li>
          <li>Las reservas o compras de participaciones no garantizan la asignación de un número específico, salvo que se indique expresamente en la rifa correspondiente.</li>
        </ul>

        <h2 id="ganadores" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">6. Selección de ganadores y entrega de premios</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Los ganadores se seleccionarán conforme al mecanismo de sorteo previamente publicado para cada rifa.</li>
          <li>La entrega del premio requiere la verificación de identidad del ganador y el cumplimiento estricto de las reglas aplicables a la rifa.</li>
          <li>Si el ganador no responde o no reclama su premio dentro del plazo razonable indicado, PRIZO podrá declarar el premio desierto o seleccionar un ganador suplente, según las normas de la rifa.</li>
        </ul>

        <h2 id="conducta" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">7. Conducta prohibida</h2>
        <p>Queda terminantemente prohibido: el uso fraudulento, automatizado o abusivo de la Plataforma; la manipulación de resultados o probabilidades; la suplantación de identidad; y cualquier conducta que infrinja la ley o estos Términos. PRIZO podrá suspender o cancelar cuentas, participaciones y/o premios cuando existan indicios razonables de incumplimiento, fraude o uso indebido de la Plataforma.</p>

        <h2 id="privacidad" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">8. Datos personales y privacidad</h2>
        <p>Utilizamos tus datos personales para gestionar tu participación, realizar verificaciones de identidad y contactarte en caso de resultar ganador, entre otros fines legítimos relacionados con la operación de la Plataforma. Al continuar utilizando la Plataforma, consientes el tratamiento de tus datos conforme a nuestra Política de Privacidad vigente (publicada en la Plataforma). Puedes ejercer tus derechos de acceso, rectificación, actualización o supresión escribiéndonos por los canales oficiales.</p>

        <h2 id="propiedad" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">9. Propiedad intelectual</h2>
        <p>Todo el contenido disponible en la Plataforma (logotipos, marcas, nombres comerciales, imágenes, diseños, textos, interfaces, código, material audiovisual y demás elementos protegidos) pertenece a PRIZO o a sus respectivos titulares. El uso de la Plataforma no otorga licencia ni otro derecho sobre dichos elementos salvo autorización expresa y por escrito.</p>

        <h2 id="responsabilidad" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">10. Limitación de responsabilidad</h2>
        <p>La Plataforma se proporciona en el estado y disponibilidad actuales, sin garantías explícitas o implícitas sobre su funcionamiento, continuidad, seguridad o ausencia de errores. En la medida permitida por la ley aplicable, PRIZO no será responsable por daños indirectos, incidentales, especiales, consecuenciales, pérdida de datos o de beneficios derivados del uso de la Plataforma, de interrupciones del servicio o de la participación en las rifas.</p>

        <h2 id="modificaciones" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">11. Modificaciones</h2>
        <p>PRIZO podrá modificar estos Términos en cualquier momento. La versión actualizada será publicada en la Plataforma e indicará la fecha de última actualización. Cuando los cambios sean relevantes, podremos notificarte por los medios disponibles o mediante avisos dentro de la Plataforma. El uso continuado tras la publicación implicará aceptación.</p>

        <h2 id="contacto" className="mt-12 text-3xl font-bold tracking-tight scroll-mt-20">12. Contacto</h2>
        <p>Si tienes preguntas, solicitudes o reclamos sobre estos Términos o el funcionamiento de la Plataforma, comunícate a través de los canales oficiales publicados en prizove.com.</p>
      </section>

      <footer className="mt-12 text-xs text-gray-500 space-y-1">
      </footer>
    </main>
  );
}
