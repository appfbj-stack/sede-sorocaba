import { Shield, Download, Trash2, CheckCircle, FileText } from 'lucide-react';

export default function Privacidade() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={28} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Política de Privacidade</h1>
          <p className="text-sm text-gray-500">LGPD — Lei Geral de Proteção de Dados (Lei 13.709/2018)</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Dados coletados</h2>
          <p>Coletamos os seguintes dados pessoais dos membros para fins de gestão eclesiástica:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Nome completo, CPF, RG, data de nascimento</li>
            <li>Telefone, WhatsApp, endereço</li>
            <li>Estado civil, foto</li>
            <li>Dados religiosos: data de conversão, data de batismo, cargo</li>
            <li>Dados ministeriais (obreiros): credencial, categoria, validade</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Finalidade do tratamento</h2>
          <p>Os dados são utilizados exclusivamente para a administração interna da igreja, incluindo:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Cadastro de membros e sua gestão</li>
            <li>Emissão de carteirinhas de membresia</li>
            <li>Registro de obreiros e credenciais ministeriais</li>
            <li>Controle de batismos e eventos</li>
            <li>Comunicação institucional</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Base legal</h2>
          <p>O tratamento de dados é realizado com base no <strong>consentimento</strong> do titular (Art. 7º, I da LGPD) e no <strong>legítimo interesse</strong> da administração eclesiástica (Art. 7º, IX).</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Direitos do titular</h2>
          <p>Garantimos a você, titular dos dados, os seguintes direitos:</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            {[
              { icon: CheckCircle, title: 'Confirmação e acesso', desc: 'Saiba quais dados tratamos sobre você' },
              { icon: Download, title: 'Exportação', desc: 'Solicite uma cópia dos seus dados em formato JSON' },
              { icon: Trash2, title: 'Anonimização', desc: 'Solicite a remoção dos seus dados pessoais (direito ao esquecimento)' },
              { icon: FileText, title: 'Revogação do consentimento', desc: 'Retire seu consentimento a qualquer momento' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <Icon size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Compartilhamento</h2>
          <p>Não compartilhamos dados pessoais com terceiros. Os dados são acessíveis apenas por administradores autorizados da igreja, dentro do sistema Kairos.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Segurança</h2>
          <p>Os dados são armazenados em banco de dados protegido com criptografia em trânsito (HTTPS) e hash de senhas (bcrypt). O acesso ao sistema é controlado por autenticação JWT com sessões revogáveis.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Retenção</h2>
          <p>Os dados são mantidos enquanto o vínculo do membro com a igreja estiver ativo. Após solicitação de anonimização, os dados pessoais são removidos permanentemente, mantendo-se apenas registros anonimizados para fins históricos.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Contato</h2>
          <p>Para exercer seus direitos ou esclarecer dúvidas, entre em contato com o administrador do sistema ou pelo e-mail de contato da igreja.</p>
        </section>
      </div>

      <div className="text-center text-xs text-gray-400">
        <p>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
      </div>
    </div>
  );
}